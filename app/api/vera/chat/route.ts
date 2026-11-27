import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVeraProvider } from "@/lib/vera/provider";
import { getFinancePlanAccess } from "@/lib/server/gold-access";
import { checkVeraAiEligibility } from "@/lib/server/vera-ai-eligibility";

import type { VeraMessage, VeraFinancialContext, VeraMemory } from "@/lib/vera/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

type Period = "daily" | "weekly" | "monthly" | "yearly";
type MovementRow = {
  type: "income" | "expense";
  amount: number | string;
  category: string | null;
  movement_date: string;
};

function buenosAiresToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startDate(period: Period, today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === "weekly") date.setUTCDate(date.getUTCDate() - 6);
  if (period === "monthly") date.setUTCDate(1);
  if (period === "yearly") date.setUTCMonth(0, 1);
  return date.toISOString().slice(0, 10);
}

function previousStartDate(period: Period, currentFrom: string) {
  const [year, month, day] = currentFrom.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === "daily") date.setUTCDate(date.getUTCDate() - 1);
  if (period === "weekly") date.setUTCDate(date.getUTCDate() - 7);
  if (period === "monthly") date.setUTCMonth(date.getUTCMonth() - 1);
  if (period === "yearly") date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function summarizeMovements(movements: MovementRow[]) {
  const income = movements.filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = movements.filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const categories = new Map<string, number>();
  movements.filter((item) => item.type === "expense").forEach((item) => {
    const category = item.category?.trim() || "Sin categoría";
    categories.set(category, (categories.get(category) ?? 0) + Number(item.amount));
  });
  return {
    income,
    expenses,
    netBalance: income - expenses,
    movementsCount: movements.length,
    categoryTotals: Array.from(categories, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
  };
}

function detectPurchase(messages: VeraMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const combined = userMessages.join("\n");
  const intent = /\b(compr(?:a|ar|é|o)|adquirir|heladera|notebook|televisor|celular|mueble|electrodoméstico)\b/i.test(combined);
  if (!intent) return null;
  const match = combined.match(/(?:compr(?:a|ar|é|o)|adquirir|heladera|notebook|televisor|celular|mueble|electrodoméstico)[^$\d]{0,100}(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{6,})(?:,\d{1,2})?/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(/\D/g, ""));
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const itemMatch = combined.match(/(?:compra de|comprar|adquirir)\s+(?:un|una|el|la)?\s*([^$,\.\n]{2,48}?)(?:\s+(?:por|de)\s+\$?\s*\d|[,\.\n]|$)/i);
  return { amount, item: itemMatch?.[1]?.trim() || "compra indicada" };
}

function rateFinancialHealth(input: {
  income: number; expenses: number; liquidBalance: number | null; sampleDays: number; movementCount: number;
}) {
  if (input.sampleDays < 60 || input.movementCount < 6 || input.income <= 0) return {
    label: "Datos insuficientes" as const, savingsRatePercent: null, expenseCoverageMonths: null,
  };
  const surplus = input.income - input.expenses;
  const savingsRatePercent = (surplus / input.income) * 100;
  const expenseCoverageMonths = input.liquidBalance !== null && input.expenses > 0
    ? input.liquidBalance / input.expenses : null;
  let label: "Excelente" | "Saludable" | "Estable" | "Ajustada" | "Crítica";
  if (surplus < 0 && (expenseCoverageMonths === null || expenseCoverageMonths < 1)) label = "Crítica";
  else if (surplus < 0 || savingsRatePercent < 5 || (expenseCoverageMonths !== null && expenseCoverageMonths < 1)) label = "Ajustada";
  else if (savingsRatePercent >= 25 && expenseCoverageMonths !== null && expenseCoverageMonths >= 6) label = "Excelente";
  else if (savingsRatePercent >= 15 && expenseCoverageMonths !== null && expenseCoverageMonths >= 3) label = "Saludable";
  else label = "Estable";
  return { label, savingsRatePercent, expenseCoverageMonths };
}

function isPeriod(value: unknown): value is Period {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

function isMessages(value: unknown): value is VeraMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) return false;
  return value.every((item) =>
    item &&
    (item.role === "user" || item.role === "model") &&
    typeof item.content === "string" &&
    item.content.trim().length > 0 &&
    item.content.length <= 3000
  ) && value[0].role === "user" && value[value.length - 1].role === "user";
}

function extractComputerAmount(message: string, allowUnlabeledAmount = false) {
  const normalized = message.trim();
  if (!normalized) return null;

  // Aceptamos una cifra sola porque VERA puede haber pedido el precio en otro chat.
  const isAmountOnly =
    /^(?:\$\s*)?\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?(?:\s*(?:ars|pesos?))?$/i.test(normalized) ||
    /^(?:\$\s*)?\d{6,}(?:,\d{1,2})?(?:\s*(?:ars|pesos?))?$/i.test(normalized);
  const hasPriceCue = /\b(una de|precio|presupuesto|sale|cuesta|vale|valor|es de)\b/i.test(normalized);
  if (!isAmountOnly && !hasPriceCue && !allowUnlabeledAmount) return null;

  const match = normalized.match(/(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{6,})(?:,\d{1,2})?/);
  const digits = match?.[1].replace(/\D/g, "");
  const amount = digits ? Number(digits) : null;
  return amount && Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function extractComputerGoal(messages: VeraMessage[], hasExistingGoal: boolean) {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const combined = userMessages.join("\n").toLocaleLowerCase("es");
  const explicitlyMentionsGoal =
    /\b(computadora|pc|ordenador|notebook|laptop)\b/.test(combined) &&
    /\b(ahorrar|ahorro|comprar|comprarme|quiero una|quiero comprar|objetivo)\b/.test(combined);

  if (!explicitlyMentionsGoal && !hasExistingGoal) return null;

  // Si el objetivo ya existe, asociamos un precio enviado en un mensaje separado.
  const latestUserMessage = userMessages[userMessages.length - 1] ?? "";
  const amount = explicitlyMentionsGoal
    ? userMessages.map((message) => extractComputerAmount(message, true)).find((value) => value !== null) ?? null
    : extractComputerAmount(latestUserMessage);

  return {
    memoryKey: "goal:computer_purchase",
    category: "goal" as const,
    content: "Ahorrar para comprar una computadora",
    details: amount !== null ? { target_amount: amount, currency: "ARS" } : {},
  };
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Tu sesión no está disponible. Volvé a iniciar sesión." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "El servicio financiero no está configurado." }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Tu sesión venció. Volvé a iniciar sesión." }, { status: 401 });
    }
    const eligibility = await checkVeraAiEligibility(supabase, authData.user.id);
    if (!eligibility.allowed) return NextResponse.json({ error: eligibility.error }, { status: eligibility.status });

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    }
    const input = body as { messages?: unknown; period?: unknown };
    if (!isMessages(input.messages) || !isPeriod(input.period)) {
      return NextResponse.json({ error: "La conversación no tiene un formato válido." }, { status: 400 });
    }

    // Recuperamos el objetivo existente antes de detectar nuevos datos.
    const { data: existingGoal, error: existingGoalError } = await supabase
      .from("vera_memories")
      .select("details")
      .eq("user_id", authData.user.id)
      .eq("memory_key", "goal:computer_purchase")
      .maybeSingle();
    if (existingGoalError) throw existingGoalError;

    // Guardamos el objetivo si se menciona explícitamente o si se aporta
    // un precio separado y ya existe ese objetivo para este usuario.
    const detectedGoal = extractComputerGoal(input.messages, Boolean(existingGoal));
    if (detectedGoal) {
      const existingDetails =
        existingGoal?.details &&
        typeof existingGoal.details === "object" &&
        !Array.isArray(existingGoal.details)
          ? existingGoal.details as Record<string, unknown>
          : {};
      const mergedDetails = { ...existingDetails, ...detectedGoal.details };

      const { error: memoryWriteError } = await supabase
        .from("vera_memories")
        .upsert({
          user_id: authData.user.id,
          memory_key: detectedGoal.memoryKey,
          category: detectedGoal.category,
          content: detectedGoal.content,
          details: mergedDetails,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,memory_key" });
      if (memoryWriteError) throw memoryWriteError;
    }

    const { data: memoryRows, error: memoriesError } = await supabase
      .from("vera_memories")
      .select("category, content, details")
      .eq("user_id", authData.user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (memoriesError) throw memoriesError;
    const memories = (memoryRows ?? []) as VeraMemory[];

    const { data: profile, error: profileError } = await supabase
      .from("financial_profiles")
      .select("currency, pay_frequency, typical_income, income_sources, expense_categories, protected_reserve_amount, protected_reserve_currency")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const currency = typeof profile?.currency === "string" ? profile.currency : "ARS";
    const today = buenosAiresToday();
    const from = startDate(input.period, today);
    const planAccess = await getFinancePlanAccess(supabase, authData.user.id);
    const isPlus = planAccess.isPlus;
    if (!isPlus && input.messages.length > 12) {
      return NextResponse.json({ error: "El historial extendido de VERA requiere FINANCE PLUS." }, { status: 403 });
    }
    const previousFrom = previousStartDate(input.period, from);
    const previousToDate = new Date(`${from}T00:00:00.000Z`);
    previousToDate.setUTCDate(previousToDate.getUTCDate() - 1);
    const previousTo = previousToDate.toISOString().slice(0, 10);

    const { data: rows, error: movementError } = await supabase
      .from("movements")
      .select("type, amount, category, movement_date")
      .eq("user_id", authData.user.id)
      .eq("currency", currency)
      .gte("movement_date", isPlus ? previousFrom : from)
      .lte("movement_date", today)
      .order("movement_date", { ascending: false })
      .limit(5000);
    if (movementError) throw movementError;

    const allMovements = (rows ?? []) as MovementRow[];
    const movements = allMovements.filter((item) => item.movement_date >= from);
    const currentSummary = summarizeMovements(movements);
    const previousMovements = isPlus
      ? allMovements.filter((item) => item.movement_date >= previousFrom && item.movement_date <= previousTo)
      : [];
    const previousSummary = isPlus ? summarizeMovements(previousMovements) : null;

    let financialPosition: VeraFinancialContext["financialPosition"];
    let decisionSimulation: VeraFinancialContext["decisionSimulation"];
    if (isPlus) {
      const sixMonthsAgo = new Date(`${today}T00:00:00.000Z`);
      sixMonthsAgo.setUTCDate(sixMonthsAgo.getUTCDate() - 179);
      const positionFrom = sixMonthsAgo.toISOString().slice(0, 10);
      const [{ data: accountRows, error: accountError }, { data: balanceRows, error: balanceError }] = await Promise.all([
        supabase.from("financial_accounts").select("id, currency, initial_balance, is_archived").eq("user_id", authData.user.id).eq("currency", currency).eq("is_archived", false),
        supabase.from("movements").select("account_id, type, amount, movement_date, description, currency").eq("user_id", authData.user.id).eq("currency", currency).gte("movement_date", "2000-01-01").lte("movement_date", today).order("movement_date", { ascending: true }).limit(10000),
      ]);
      if (accountError) throw accountError;
      if (balanceError) throw balanceError;

      const accounts = accountRows ?? [];
      const accountIds = new Set(accounts.map((account) => account.id));
      const balances = new Map<string, number>(accounts.map((account) => [account.id, Number(account.initial_balance)]));
      const accountMovements = balanceRows ?? [];
      accountMovements.forEach((movement) => {
        if (!movement.account_id || !balances.has(movement.account_id)) return;
        balances.set(movement.account_id, (balances.get(movement.account_id) ?? 0) + (movement.type === "income" ? 1 : -1) * Number(movement.amount));
      });
      const liquidBalance = accounts.length ? Array.from(balances.values()).reduce((sum, value) => sum + value, 0) : null;
      const recentMovements = accountMovements.filter((movement) => movement.movement_date >= positionFrom);
      const oldest = recentMovements[0]?.movement_date;
      const sampleDays = oldest
        ? Math.max(1, Math.min(180, Math.ceil((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86400000) + 1))
        : 0;
      const sampleMonths = Math.max(1, sampleDays / 30);
      const recentIncome = recentMovements.filter((movement) => movement.type === "income").reduce((sum, movement) => sum + Number(movement.amount), 0);
      const recentExpenses = recentMovements.filter((movement) => movement.type === "expense").reduce((sum, movement) => sum + Number(movement.amount), 0);
      const monthlyIncomeAverage = recentIncome / sampleMonths;
      const monthlyExpensesAverage = recentExpenses / sampleMonths;
      const health = rateFinancialHealth({
        income: monthlyIncomeAverage,
        expenses: monthlyExpensesAverage,
        liquidBalance,
        sampleDays,
        movementCount: recentMovements.length,
      });
      financialPosition = {
        currency,
        liquidBalance,
        monthlyIncomeAverage,
        monthlyExpensesAverage,
        monthlySurplusAverage: monthlyIncomeAverage - monthlyExpensesAverage,
        sampleDays,
        accountsCount: accounts.length,
        balanceComplete: accountMovements.length < 10000,
        healthRating: health.label,
        savingsRatePercent: health.savingsRatePercent,
        expenseCoverageMonths: health.expenseCoverageMonths,
      };

      const purchase = detectPurchase(input.messages);
      if (purchase) {
        decisionSimulation = {
          type: "purchase",
          item: purchase.item,
          amount: purchase.amount,
          currency,
          currentLiquidBalance: liquidBalance,
          liquidBalanceAfterCashPurchase: liquidBalance === null ? null : liquidBalance - purchase.amount,
          monthlySurplusAverage: monthlyIncomeAverage - monthlyExpensesAverage,
          projections: ([3, 6, 12] as const).map((months) => {
            const baseline = liquidBalance === null ? null : liquidBalance + (monthlyIncomeAverage - monthlyExpensesAverage) * months;
            const scenario = liquidBalance === null ? null : liquidBalance - purchase.amount + (monthlyIncomeAverage - monthlyExpensesAverage) * months;
            return {
              months,
              baselineLiquidBalance: baseline,
              purchaseScenarioLiquidBalance: scenario,
              difference: baseline === null || scenario === null ? null : scenario - baseline,
              differencePercent: baseline === null || scenario === null || baseline === 0 ? null : ((scenario - baseline) / Math.abs(baseline)) * 100,
            };
          }),
          assumptions: [
            "Compra pagada al contado en el momento inicial.",
            "El promedio mensual de ingresos y gastos recientes se mantiene durante la proyección.",
            "No se incluyen intereses, cuotas, inflación, depreciación, deudas ni costos adicionales no informados.",
            "El saldo de cuentas no representa el patrimonio neto completo: no incluye efectivo externo, bienes ni pasivos no registrados.",
          ],
        };
      }
    }

    let goalContext: NonNullable<VeraFinancialContext["goals"]> | undefined;
    const { data: goalRows, error: goalRowsError } = await supabase
      .from("financial_goals")
      .select("id, title, target_amount, currency, target_date, status")
      .eq("user_id", authData.user.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (goalRowsError && !["42P01", "PGRST205"].includes(goalRowsError.code || "")) throw goalRowsError;
    if (!goalRowsError) {
      const goalIds = (goalRows ?? []).map((goal) => goal.id);
      let goalMovementRows: Array<{ goal_id: string; type: "income" | "expense"; amount: number | string; status: "pending" | "posted" | "cancelled" }> = [];
      if (goalIds.length) {
        const { data, error } = await supabase
          .from("financial_goal_movements")
          .select("goal_id, type, amount, status")
          .eq("user_id", authData.user.id)
          .in("goal_id", goalIds);
        if (error && !["42P01", "PGRST205"].includes(error.code || "")) throw error;
        if (!error) goalMovementRows = (data ?? []) as typeof goalMovementRows;
      }

      goalContext = (goalRows ?? []).map((goal) => {
        const movements = goalMovementRows.filter((entry) => entry.goal_id === goal.id);
        const posted = movements.filter((entry) => entry.status === "posted");
        const targetAmount = Number(goal.target_amount);
        const savedAmount = posted.reduce((sum, entry) =>
          sum + (entry.type === "income" ? Number(entry.amount) : -Number(entry.amount)), 0);
        return {
          title: goal.title,
          currency: goal.currency,
          targetAmount,
          savedAmount: Math.max(0, savedAmount),
          remainingAmount: Math.max(0, targetAmount - savedAmount),
          progressPercent: Math.min(100, Math.max(0, Math.round((savedAmount / targetAmount) * 1000) / 10)),
          targetDate: goal.target_date,
          status: goal.status as "active" | "paused" | "completed",
          contributionCount: posted.length,
        };
      });
    }

    const [{ data: accountContextRows, error: accountContextError }, { data: commitmentRows, error: commitmentError }, { data: transferContextRows, error: transferContextError }, { data: accountMovementRows, error: accountMovementError }] = await Promise.all([
      supabase.from("financial_accounts").select("id, name, type, currency, initial_balance, is_archived").eq("user_id", authData.user.id).order("created_at", { ascending: true }).limit(200),
      supabase.from("financial_commitments").select("name, category, amount, currency, frequency, due_date").eq("user_id", authData.user.id).eq("is_active", true).order("due_date", { ascending: true }).limit(100),
      supabase.from("account_transfers").select("from_account_id, to_account_id, amount, currency, created_at").eq("user_id", authData.user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("movements").select("account_id, type, amount, currency").eq("user_id", authData.user.id).not("account_id", "is", null).limit(10000),
    ]);
    if (accountContextError) throw accountContextError;
    if (commitmentError) throw commitmentError;
    if (transferContextError) throw transferContextError;
    if (accountMovementError) throw accountMovementError;

    const accountNames = new Map((accountContextRows ?? []).map((account) => [account.id, account.name]));
    const accountCurrencies = new Map((accountContextRows ?? []).map((account) => [account.id, account.currency]));
    const accountBalances = new Map((accountContextRows ?? []).map((account) => [account.id, Number(account.initial_balance)]));
    (accountMovementRows ?? []).forEach((movement) => {
      if (!movement.account_id || !accountBalances.has(movement.account_id)) return;
      // Cada saldo se calcula únicamente con movimientos de la moneda de esa cuenta.
      if (movement.currency !== accountCurrencies.get(movement.account_id)) return;
      accountBalances.set(movement.account_id, (accountBalances.get(movement.account_id) ?? 0) + (movement.type === "income" ? 1 : -1) * Number(movement.amount));
    });
    (transferContextRows ?? []).forEach((transfer) => {
      if (accountBalances.has(transfer.from_account_id)) accountBalances.set(transfer.from_account_id, (accountBalances.get(transfer.from_account_id) ?? 0) - Number(transfer.amount));
      if (accountBalances.has(transfer.to_account_id)) accountBalances.set(transfer.to_account_id, (accountBalances.get(transfer.to_account_id) ?? 0) + Number(transfer.amount));
    });
    const accountContext = (accountContextRows ?? []).map((account) => ({
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: accountBalances.get(account.id) ?? Number(account.initial_balance),
      archived: account.is_archived,
    }));
    const commitmentContext = (commitmentRows ?? []).map((item) => ({
      name: item.name, category: item.category, amount: Number(item.amount),
      currency: item.currency, frequency: item.frequency, dueDate: item.due_date,
    }));
    const transferContext = (transferContextRows ?? []).map((item) => ({
      date: item.created_at.slice(0, 10),
      amount: Number(item.amount),
      currency: item.currency,
      fromAccount: accountNames.get(item.from_account_id) ?? "Cuenta de origen",
      toAccount: accountNames.get(item.to_account_id) ?? "Cuenta de destino",
    }));
    const tomorrow = new Date(`${today}T00:00:00-03:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const currentTransferQuery = supabase.from("account_transfers").select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id).eq("currency", currency)
      .gte("created_at", `${from}T00:00:00-03:00`).lt("created_at", tomorrow.toISOString());
    const previousTransferQuery = supabase.from("account_transfers").select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id).eq("currency", currency)
      .gte("created_at", `${previousFrom}T00:00:00-03:00`).lt("created_at", `${from}T00:00:00-03:00`);
    const [{ count: currentTransfersCount, error: currentTransferCountError }, { count: previousTransfersCount, error: previousTransferCountError }] = await Promise.all([
      currentTransferQuery,
      isPlus ? previousTransferQuery : Promise.resolve({ count: 0, error: null }),
    ]);
    if (currentTransferCountError) throw currentTransferCountError;
    if (previousTransferCountError) throw previousTransferCountError;
    currentSummary.movementsCount += currentTransfersCount ?? 0;
    if (previousSummary) previousSummary.movementsCount += previousTransfersCount ?? 0;
    const profileContext = {
      payFrequency: profile?.pay_frequency ?? "not_set",
      typicalIncome: profile?.typical_income == null ? null : Number(profile.typical_income),
      incomeSources: Array.isArray(profile?.income_sources) ? profile.income_sources : [],
      expenseCategories: Array.isArray(profile?.expense_categories) ? profile.expense_categories : [],
      protectedReserveAmount: profile?.protected_reserve_amount == null ? null : Number(profile.protected_reserve_amount),
      protectedReserveCurrency: profile?.protected_reserve_currency ?? null,
    };

    const financialContext: VeraFinancialContext = {
      currency,
      period: input.period,
      ...currentSummary,
      profile: profileContext,
      accounts: accountContext,
      commitments: commitmentContext,
      transfers: transferContext,
      ...(goalContext ? { goals: goalContext } : {}),
      experience: isPlus ? "plus" : "standard",
      ...(financialPosition ? { financialPosition } : {}),
      ...(decisionSimulation ? { decisionSimulation } : {}),
      ...(previousSummary ? {
        previousPeriod: {
          from: previousFrom,
          to: previousTo,
          ...previousSummary,
        },
      } : {}),
    };

    const provider = getVeraProvider();
    const result = await provider.generate({
      messages: input.messages,
      financialContext,
      memories,
    });

    return NextResponse.json({
      reply: result.text,
      financialSummary: {
        currency: financialContext.currency,
        period: financialContext.period,
        income: financialContext.income,
        expenses: financialContext.expenses,
        netBalance: financialContext.netBalance,
        movementsCount: financialContext.movementsCount,
      },
    });
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "";
    const providerHttpMatch = rawCode.match(/^VERA_PROVIDER_HTTP_(\d{3})$/);
    const safeCode = [
      "VERA_AI_NOT_CONFIGURED",
      "VERA_PROVIDER_RATE_LIMIT",
      "VERA_EMPTY_RESPONSE",
      "VERA_PROVIDER_TIMEOUT",
      "VERA_PROVIDER_NETWORK_ERROR",
    ].includes(rawCode)
      ? rawCode
      : providerHttpMatch
        ? `GEMINI_HTTP_${providerHttpMatch[1]}`
        : "UNCLASSIFIED_SERVER_ERROR";

    // Never log API keys, authorization headers, prompts, or financial data.
    console.error("[VERA_CHAT_DIAGNOSTIC]", { code: safeCode });

    const code = rawCode;
    if (code === "VERA_AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "VERA todavía no tiene su conexión de IA configurada." }, { status: 503 });
    }
    if (code === "VERA_PROVIDER_RATE_LIMIT") {
      return NextResponse.json({ error: "Estoy recibiendo muchas consultas en este momento. Probá de nuevo en un ratito." }, { status: 429 });
    }
    if (code === "VERA_EMPTY_RESPONSE") {
      return NextResponse.json({ error: "No pude preparar una respuesta esta vez. Intentemos de nuevo." }, { status: 502 });
    }
    if (code === "VERA_PROVIDER_TIMEOUT") {
      return NextResponse.json({ error: "La conexión con VERA tardó demasiado. Probá nuevamente." }, { status: 504 });
    }
    return NextResponse.json({ error: "No pude conectar con VERA en este momento. Intentá nuevamente." }, { status: 502 });
  }
}
