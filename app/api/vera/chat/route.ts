import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVeraProvider } from "@/lib/vera/provider";
import { isGoldEnabledForUser } from "@/lib/server/gold-access";
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

function isPeriod(value: unknown): value is Period {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

function isMessages(value: unknown): value is VeraMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return false;
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
      .select("currency")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const currency = typeof profile?.currency === "string" ? profile.currency : "ARS";
    const today = buenosAiresToday();
    const from = startDate(input.period, today);
    const isGold = isGoldEnabledForUser(authData.user);
    const previousFrom = previousStartDate(input.period, from);
    const previousToDate = new Date(`${from}T00:00:00.000Z`);
    previousToDate.setUTCDate(previousToDate.getUTCDate() - 1);
    const previousTo = previousToDate.toISOString().slice(0, 10);

    const { data: rows, error: movementError } = await supabase
      .from("movements")
      .select("type, amount, category, movement_date")
      .eq("user_id", authData.user.id)
      .eq("currency", currency)
      .gte("movement_date", isGold ? previousFrom : from)
      .lte("movement_date", today)
      .order("movement_date", { ascending: false })
      .limit(5000);
    if (movementError) throw movementError;

    const allMovements = (rows ?? []) as MovementRow[];
    const movements = allMovements.filter((item) => item.movement_date >= from);
    const currentSummary = summarizeMovements(movements);
    const previousMovements = isGold
      ? allMovements.filter((item) => item.movement_date >= previousFrom && item.movement_date <= previousTo)
      : [];
    const previousSummary = isGold ? summarizeMovements(previousMovements) : null;

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

    const financialContext: VeraFinancialContext = {
      currency,
      period: input.period,
      ...currentSummary,
      ...(goalContext ? { goals: goalContext } : {}),
      experience: isGold ? "gold" : "standard",
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
