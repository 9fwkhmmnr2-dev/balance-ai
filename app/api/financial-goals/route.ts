import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePremium } from "../../../lib/server/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: NextResponse.json({ error: "Los objetivos no están configurados." }, { status: 503 }) };
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Tu sesión venció." }, { status: 401 }) };
  return { supabase, userId: data.user.id };
}

function validCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}
function validDateKey(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 999999999999;
}
const recurringFrequencies = ["daily", "weekly", "every_15_days", "monthly", "every_2_months", "every_3_months", "every_6_months", "yearly", "custom"] as const;
function validRecurringFrequency(value: unknown): value is typeof recurringFrequencies[number] { return typeof value === "string" && recurringFrequencies.includes(value as typeof recurringFrequencies[number]); }
function validRuleMode(value: unknown): value is "confirmation" | "automatic" { return value === "confirmation" || value === "automatic"; }

type ExchangeRatesPayload = {
  result?: string;
  source?: string;
  data_updated_at?: string;
  effective_at?: Record<string, string>;
  rates?: Record<string, number>;
  stale?: Record<string, boolean>;
};

async function getReferenceRates(base: string, symbols: string[]): Promise<ExchangeRatesPayload | null> {
  if (!symbols.length) return null;
  const url = new URL(`https://api.exchangerate.dev/v1/latest/${base}`);
  url.searchParams.set("symbols", symbols.join(","));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EXCHANGERATE_API_KEY) headers.Authorization = `Bearer ${process.env.EXCHANGERATE_API_KEY}`;
  try {
    const response = await fetch(url.toString(), { headers, next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) return null;
    const payload = await response.json() as ExchangeRatesPayload;
    return payload.result === "success" && payload.rates ? payload : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  let diagnosticStage = "authentication";
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;

    diagnosticStage = "financial_goals";
    const { data: goals, error: goalsError } = await supabase
      .from("financial_goals")
      .select("id, title, target_amount, currency, target_date, status, created_at, updated_at")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (goalsError) throw goalsError;

    const ids = (goals ?? []).map((goal) => goal.id);
    const goalCurrencyById = new Map((goals ?? []).map((goal) => [goal.id, goal.currency]));
    let movements: Array<{ id: string; goal_id: string; type: "income" | "expense"; amount: number; currency: string; goal_amount: number; exchange_rate: number; rate_source: string; rate_at: string; category: string; description: string | null; movement_date: string; status: "pending" | "posted" | "cancelled"; source: string; recurring_rule_id: string | null; verification_status: "not_required" | "pending" | "verified"; verified_at: string | null; created_at: string }> = [];
    let rules: Array<{ id: string; goal_id: string; currency: string; account_id: string | null; type: "income" | "expense"; amount: number; category: string; description: string | null; frequency: string; interval_days: number | null; schedule_day: number | null; start_date: string; end_date: string | null; next_run_date: string; mode: "confirmation" | "automatic"; status: string }> = [];
    let accounts: Array<{ id: string; name: string; currency: string; is_archived: boolean }> = [];

    if (ids.length) {
      diagnosticStage = "financial_goal_movements";
      const modernMovements = await supabase
        .from("financial_goal_movements")
        .select("id, goal_id, type, amount, currency, goal_amount, exchange_rate, rate_source, rate_at, category, description, movement_date, status, source, recurring_rule_id, verification_status, verified_at, created_at")
        .eq("user_id", userId).in("goal_id", ids).order("movement_date", { ascending: false });
      if (modernMovements.error) {
        const legacyMovements = await supabase
          .from("financial_goal_movements")
          .select("id, goal_id, type, amount, category, description, movement_date, status, source, recurring_rule_id, created_at")
          .eq("user_id", userId).in("goal_id", ids).order("movement_date", { ascending: false });
        if (legacyMovements.error) {
          console.error("[financial-goals][GET] movements query failed", { code: legacyMovements.error.code ?? null, message: legacyMovements.error.message ?? "Unknown Supabase error" });
        } else {
          movements = (legacyMovements.data ?? []).map((entry) => ({ ...entry, currency: goalCurrencyById.get(entry.goal_id) ?? "ARS", goal_amount: Number(entry.amount), exchange_rate: 1, rate_source: "historical_legacy", rate_at: entry.created_at, verification_status: "not_required" as const, verified_at: null })) as typeof movements;
        }
      } else {
        movements = (modernMovements.data ?? []).map((entry) => ({ ...entry, currency: entry.currency ?? goalCurrencyById.get(entry.goal_id) ?? "ARS", goal_amount: Number(entry.goal_amount ?? entry.amount), exchange_rate: Number(entry.exchange_rate ?? 1), rate_source: entry.rate_source ?? "historical_legacy", rate_at: entry.rate_at ?? entry.created_at, verification_status: entry.verification_status ?? "not_required", verified_at: entry.verified_at ?? null })) as typeof movements;
      }

      // account_id is not part of the deployed recurring-rules schema.
      // Load the supported columns directly instead of querying then retrying.
      diagnosticStage = "financial_goal_recurring_rules";
      const modernRules = await supabase.from("financial_goal_recurring_rules")
        .select("id, goal_id, currency, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status")
        .eq("user_id", userId).in("goal_id", ids).order("next_run_date", { ascending: true });
      if (modernRules.error) {
        const legacyRules = await supabase.from("financial_goal_recurring_rules")
          .select("id, goal_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status")
          .eq("user_id", userId).in("goal_id", ids).order("next_run_date", { ascending: true });
        if (legacyRules.error) {
          console.error("[financial-goals][GET] recurring_rules query failed", { code: legacyRules.error.code ?? null, message: legacyRules.error.message ?? "Unknown Supabase error" });
        } else {
          rules = (legacyRules.data ?? []).map((rule) => ({ ...rule, currency: goalCurrencyById.get(rule.goal_id) ?? "ARS", account_id: null })) as typeof rules;
        }
      } else {
        rules = (modernRules.data ?? []).map((rule) => ({ ...rule, currency: rule.currency ?? goalCurrencyById.get(rule.goal_id) ?? "ARS" })) as typeof rules;
      }
    }

    // Accounts are optional for displaying objectives. A failed account lookup
    // must not prevent the goals and their recorded progress from loading.
    diagnosticStage = "financial_accounts";
    const { data: accountRows, error: accountsError } = await supabase
      .from("financial_accounts")
      .select("id, name, currency, is_archived")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });
    if (accountsError) {
      console.error("[financial-goals][GET] accounts query failed", {
        code: accountsError.code ?? null,
        message: accountsError.message ?? "Unknown Supabase error",
      });
    } else {
      accounts = accountRows ?? [];
    }

    const result = await Promise.all((goals ?? []).map(async (goal) => {
      const goalMovements = movements.filter((entry) => entry.goal_id === goal.id);
      const totalsByCurrency = new Map<string, { amount: number; equivalent_amount: number }>();
      for (const entry of goalMovements) {
        if (entry.status !== "posted") continue;
        const code = entry.currency || goal.currency;
        const sign = entry.type === "income" ? 1 : -1;
        const current = totalsByCurrency.get(code) ?? { amount: 0, equivalent_amount: 0 };
        current.amount += sign * Number(entry.amount);
        current.equivalent_amount += sign * Number(entry.goal_amount);
        totalsByCurrency.set(code, current);
      }
      const convertedByCurrency = [...totalsByCurrency.entries()].map(([currency, totals]) => ({
        currency, amount: totals.amount, equivalent_amount: totals.equivalent_amount,
      }));
      const saved = convertedByCurrency.reduce((sum, item) => sum + item.equivalent_amount, 0);
      const unconvertedMovementsCount = 0;
      const positiveBreakdown = convertedByCurrency.filter((item) => item.amount > 0 && item.equivalent_amount > 0);
      const breakdownTotal = positiveBreakdown.reduce((sum, item) => sum + item.equivalent_amount, 0);
      const currencyBreakdown = positiveBreakdown.map((item) => ({
        ...item, percentage: breakdownTotal > 0 ? Math.round((item.equivalent_amount / breakdownTotal) * 1000) / 10 : 0,
      }));
      const target = Number(goal.target_amount);
      return {
        ...goal,
        target_amount: target,
        saved_amount: Math.max(0, saved),
        net_amount: saved,
        remaining_amount: Math.max(0, target - saved),
        progress_percent: target > 0 ? Math.min(100, Math.max(0, Math.round((saved / target) * 1000) / 10)) : 0,
        currency_breakdown: currencyBreakdown,
        unconverted_movements_count: unconvertedMovementsCount,
        currency_rates_updated_at: goalMovements.filter((entry) => entry.status === "posted").map((entry) => entry.rate_at).sort().slice(-1)[0] ?? null,
        currency_rates_source: "Cotización indicativa guardada por movimiento",
        movements: goalMovements.map((movement) => ({
          ...movement,
          recurring_mode: rules.find((rule) => rule.id === movement.recurring_rule_id)?.mode ?? null,
        })),
        recurring_rules: rules.filter((rule) => rule.goal_id === goal.id),
      };
    }));

    return NextResponse.json({ goals: result, accounts });
  } catch (error) {
    const dbError = error as { code?: unknown; message?: unknown };
    console.error("[financial-goals][GET] request failed", {
      stage: diagnosticStage,
      code: typeof dbError?.code === "string" ? dbError.code : null,
      message: typeof dbError?.message === "string" ? dbError.message : "Unknown error",
    });
    return NextResponse.json({ error: "No pude cargar tus objetivos. Revisá que las tablas de movimientos estén disponibles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    const input = body as Record<string, unknown>;

    if (input.action === "recurring_rule") {
      if (typeof input.goalId !== "string" || (input.type !== "income" && input.type !== "expense") ||
          !validAmount(input.amount) || !validRecurringFrequency(input.frequency) || !validRuleMode(input.mode)) {
        return NextResponse.json({ error: "Revisá los datos de la regla recurrente." }, { status: 400 });
      }
      const startDate = typeof input.startDate === "string" && validDateKey(input.startDate) ? input.startDate : "";
      const endDate = input.endDate === null || input.endDate === "" || input.endDate === undefined
        ? null : typeof input.endDate === "string" && validDateKey(input.endDate) ? input.endDate : undefined;
      if (!startDate || endDate === undefined || (endDate && endDate < startDate)) {
        return NextResponse.json({ error: "Revisá las fechas de inicio y finalización." }, { status: 400 });
      }
      const intervalDays = input.frequency === "custom" && Number.isInteger(input.intervalDays) && Number(input.intervalDays) >= 1 && Number(input.intervalDays) <= 365
        ? Number(input.intervalDays) : null;
      if (input.frequency === "custom" && intervalDays === null) {
        return NextResponse.json({ error: "El intervalo personalizado debe estar entre 1 y 365 días." }, { status: 400 });
      }
      const scheduleDay = input.frequency === "monthly" && Number.isInteger(input.scheduleDay) && Number(input.scheduleDay) >= 1 && Number(input.scheduleDay) <= 31
        ? Number(input.scheduleDay) : null;
      const { data: goal, error: goalError } = await supabase.from("financial_goals")
        .select("id, status, currency").eq("id", input.goalId).eq("user_id", userId).maybeSingle();
      if (goalError) throw goalError;
      if (!goal || goal.status !== "active") return NextResponse.json({ error: "El objetivo no existe o no está activo." }, { status: 404 });
      const category = typeof input.category === "string" ? input.category.trim().slice(0, 60) : "";
      if (!category) return NextResponse.json({ error: "Elegí una categoría." }, { status: 400 });
      const description = typeof input.description === "string" ? input.description.trim().slice(0, 240) : "";
      const ruleCurrency = typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : goal.currency;
      if (ruleCurrency !== goal.currency) {
        return NextResponse.json({ error: "Las reglas recurrentes deben usar la moneda del objetivo por ahora. Los movimientos individuales sí admiten conversión multidivisa." }, { status: 400 });
      }
      const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
      if (accountId) {
        const access = await requirePremium(supabase, userId);
        if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
        const { data: account, error: accountError } = await supabase.from("financial_accounts")
          .select("id, currency, is_archived").eq("id", accountId).eq("user_id", userId).maybeSingle();
        if (accountError) throw accountError;
        if (!account || account.is_archived || account.currency !== ruleCurrency) {
          return NextResponse.json({ error: "La cuenta debe pertenecer a tu usuario, estar activa y usar la misma moneda de la regla." }, { status: 400 });
        }
      }
      const rulePayload = {
        goal_id: input.goalId, user_id: userId, type: input.type, amount: input.amount, currency: ruleCurrency,
        category, description: description || null, frequency: input.frequency,
        interval_days: intervalDays, schedule_day: scheduleDay, start_date: startDate,
        end_date: endDate, next_run_date: startDate, mode: input.mode, status: "active",
        account_id: accountId, updated_at: new Date().toISOString(),
      };
      let insertedRule = await supabase.from("financial_goal_recurring_rules").insert(rulePayload)
        .select("id, goal_id, currency, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").single();
      if (insertedRule.error && (insertedRule.error.code === "42703" || insertedRule.error.code === "PGRST204") && ruleCurrency === goal.currency) {
        const legacyPayload = { ...rulePayload } as Record<string, unknown>;
        delete legacyPayload.currency;
        delete legacyPayload.account_id;
        const legacyInsertedRule = await supabase.from("financial_goal_recurring_rules").insert(legacyPayload)
          .select("id, goal_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").single();
        if (legacyInsertedRule.error) throw legacyInsertedRule.error;
        if (legacyInsertedRule.data) {
          return NextResponse.json({ rule: { ...legacyInsertedRule.data, currency: goal.currency, account_id: null } }, { status: 201 });
        }
        return NextResponse.json({ error: "No se pudo crear la regla recurrente." }, { status: 500 });
      }
      if (insertedRule.error) throw insertedRule.error;
      return NextResponse.json({ rule: insertedRule.data }, { status: 201 });
    }

    if (input.action === "movement") {
      if (typeof input.goalId !== "string" || !validAmount(input.amount) ||
          (input.type !== "income" && input.type !== "expense")) {
        return NextResponse.json({ error: "Revisá el objetivo, el tipo y el importe del movimiento." }, { status: 400 });
      }
      const { data: goal, error: goalError } = await supabase.from("financial_goals")
        .select("id, status, currency").eq("id", input.goalId).eq("user_id", userId).maybeSingle();
      if (goalError) throw goalError;
      if (!goal || goal.status !== "active") return NextResponse.json({ error: "El objetivo no existe o no está activo." }, { status: 404 });
      const movementCurrency = typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : goal.currency;
      let exchangeRate = 1;
      let rateSource = "same_currency";
      let rateAt = new Date().toISOString();
      if (movementCurrency !== goal.currency) {
        const rateData = await getReferenceRates(goal.currency, [movementCurrency]);
        const quotedRate = rateData?.rates?.[movementCurrency];
        if (!rateData || typeof quotedRate !== "number" || !Number.isFinite(quotedRate) || quotedRate <= 0 || rateData.stale?.[movementCurrency] === true) {
          return NextResponse.json({ error: "No hay una cotización vigente para convertir este movimiento. No se guardó; intentá nuevamente más tarde." }, { status: 503 });
        }
        exchangeRate = 1 / quotedRate;
        rateSource = "ExchangeRate.dev (" + (rateData.source ?? "indicative") + ")";
        rateAt = rateData.data_updated_at && Number.isFinite(Date.parse(rateData.data_updated_at))
          ? new Date(rateData.data_updated_at).toISOString() : new Date().toISOString();
      }
      const goalAmount = Number((Number(input.amount) * exchangeRate).toFixed(8));
      const movementDate = typeof input.movementDate === "string" && validDateKey(input.movementDate)
        ? input.movementDate : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      const category = typeof input.category === "string" ? input.category.trim().slice(0, 60) : "";
      if (!category) return NextResponse.json({ error: "Elegí una categoría para el movimiento." }, { status: 400 });
      const description = typeof input.description === "string" ? input.description.trim().slice(0, 240) : "";
      const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
      if (accountId) {
        const { data: account, error: accountError } = await supabase.from("financial_accounts")
          .select("id, currency, is_archived").eq("id", accountId).eq("user_id", userId).maybeSingle();
        if (accountError) throw accountError;
        if (!account || account.is_archived || account.currency !== movementCurrency) {
          return NextResponse.json({ error: "La cuenta debe usar la misma moneda del movimiento." }, { status: 400 });
        }
      }
      const { data: movementId, error } = await supabase.rpc("create_goal_movement_multi_currency", {
        p_goal_id: input.goalId, p_user_id: userId, p_type: input.type,
        p_amount: input.amount, p_currency: movementCurrency, p_category: category,
        p_description: description || null, p_occurred_at: movementDate,
        p_account_id: accountId, p_source: "manual", p_recurring_rule_id: null,
        p_scheduled_for_date: null, p_status: "posted",
        p_verification_status: "not_required", p_goal_amount: goalAmount,
        p_exchange_rate: exchangeRate, p_rate_source: rateSource, p_rate_at: rateAt,
      });
      if (error) {
        const missingFunction = error.code === "42883" || error.code === "PGRST202" ||
          /create_goal_movement_multi_currency/i.test(error.message ?? "");
        if (missingFunction) {
          return NextResponse.json({
            error: "La migración multidivisa de objetivos todavía no está aplicada en Supabase. No se guardó el movimiento.",
          }, { status: 409 });
        }
        throw error;
      }
      return NextResponse.json({ movementId }, { status: 201 });
    }

    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 80 || !validAmount(input.targetAmount) || !validCurrency(input.currency)) {
      return NextResponse.json({ error: "Completá un nombre, un importe válido y una moneda admitida." }, { status: 400 });
    }
    const targetDate = input.targetDate === null || input.targetDate === "" || input.targetDate === undefined
      ? null : typeof input.targetDate === "string" && validDateKey(input.targetDate) ? input.targetDate : undefined;
    if (targetDate === undefined) return NextResponse.json({ error: "La fecha objetivo no es válida." }, { status: 400 });
    const { data, error } = await supabase.from("financial_goals")
      .insert({ user_id: userId, title, target_amount: input.targetAmount, currency: input.currency, target_date: targetDate })
      .select("id, title, target_amount, currency, target_date, status, created_at").single();
    if (error) throw error;
    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: unknown; message?: unknown };
    const errorCode = typeof dbError?.code === "string" ? dbError.code : null;
    const errorMessage = typeof dbError?.message === "string" ? dbError.message : "Unknown error";
    console.error("[financial-goals][POST] request failed", {
      code: errorCode,
      message: errorMessage,
    });
    const schemaMismatch = ["42703", "42883", "PGRST202", "PGRST204"].includes(errorCode ?? "") ||
      /column .* does not exist|could not find the .* column|function .* does not exist/i.test(errorMessage);
    if (schemaMismatch) {
      return NextResponse.json({
        error: "La estructura de objetivos de Supabase Preview no está actualizada. No se registró el movimiento; hay que revisar la migración antes de volver a intentar.",
      }, { status: 409 });
    }
    return NextResponse.json({ error: "No pude guardar el movimiento. Revisá los datos e intentá nuevamente." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (input.action === "correct_automatic_movement") {
      if (typeof input.goalId !== "string" || typeof input.movementId !== "string" ||
          !validAmount(input.amount) || typeof input.category !== "string" ||
          !input.category.trim() || typeof input.movementDate !== "string" || !validDateKey(input.movementDate)) {
        return NextResponse.json({ error: "Revisá el importe, la categoría y la fecha corregidos." }, { status: 400 });
      }
      const description = typeof input.description === "string" ? input.description.trim().slice(0, 240) : "";
      const { data, error } = await supabase.rpc("correct_goal_movement_multi_currency", {
        p_goal_movement_id: input.movementId, p_user_id: userId, p_amount: input.amount,
        p_category: input.category.trim().slice(0, 60), p_description: description || null,
        p_occurred_at: input.movementDate,
      });
      if (error) {
        const missingFunction = error.code === "42883" || error.code === "PGRST202" || /correct_goal_movement_multi_currency/i.test(error.message ?? "");
        if (!missingFunction) throw error;
        const legacy = await supabase.rpc("correct_linked_goal_movement", {
          p_goal_movement_id: input.movementId, p_user_id: userId, p_amount: input.amount,
          p_category: input.category.trim().slice(0, 60), p_description: description || null,
          p_movement_date: input.movementDate,
        });
        if (legacy.error) throw legacy.error;
        return NextResponse.json({ movementId: legacy.data });
      }
      return NextResponse.json({ movementId: data });
    }

    if (input.action === "verify_automatic_movement") {
      if (typeof input.goalId !== "string" || typeof input.movementId !== "string") {
        return NextResponse.json({ error: "La comprobación del movimiento no es válida." }, { status: 400 });
      }
      const { data, error } = await supabase.from("financial_goal_movements")
        .update({ verification_status: "verified", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", input.movementId).eq("goal_id", input.goalId).eq("user_id", userId)
        .eq("source", "recurring").eq("status", "posted").eq("verification_status", "pending")
        .select("id, verification_status, verified_at").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "El movimiento ya fue comprobado o no existe." }, { status: 404 });
      return NextResponse.json({ movement: data });
    }

    if (input.action === "movement_status") {
      if (typeof input.goalId !== "string" || typeof input.movementId !== "string" ||
          (input.status !== "posted" && input.status !== "cancelled")) {
        return NextResponse.json({ error: "La actualización del movimiento no es válida." }, { status: 400 });
      }
      if (input.status === "posted") {
        const { data, error } = await supabase.rpc("confirm_goal_movement_multi_currency", {
          p_goal_movement_id: input.movementId, p_user_id: userId,
        });
        if (error) {
          const missingFunction = error.code === "42883" || error.code === "PGRST202" || /confirm_goal_movement_multi_currency/i.test(error.message ?? "");
          if (!missingFunction) throw error;
          const legacy = await supabase.rpc("confirm_linked_goal_movement", { p_goal_movement_id: input.movementId, p_user_id: userId });
          if (legacy.error) throw legacy.error;
          return NextResponse.json({ movementId: legacy.data });
        }
        return NextResponse.json({ movementId: data });
      }
      const { data, error } = await supabase.from("financial_goal_movements")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", input.movementId).eq("goal_id", input.goalId).eq("user_id", userId)
        .eq("source", "recurring").eq("status", "pending")
        .select("id, status").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "El movimiento ya fue procesado o no existe." }, { status: 404 });
      return NextResponse.json({ movement: data });
    }

    if (input.action === "recurring_rule") {
      if (typeof input.ruleId !== "string" || typeof input.goalId !== "string") {
        return NextResponse.json({ error: "La regla recurrente no es válida." }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      let recurringGoalCurrency: string | null = null;
      if (typeof input.status === "string") {
        if (!["active", "paused", "completed"].includes(input.status)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
        updates.status = input.status;
      }
      const editing = ["type", "amount", "currency", "category", "description", "frequency", "intervalDays", "scheduleDay", "startDate", "endDate", "mode", "accountId"].some((key) => key in input);
      if (editing) {
        if ((input.type !== "income" && input.type !== "expense") || !validAmount(input.amount) ||
            !validRecurringFrequency(input.frequency) || !validRuleMode(input.mode)) {
          return NextResponse.json({ error: "Revisá los datos de la regla recurrente." }, { status: 400 });
        }
        const startDate = typeof input.startDate === "string" && validDateKey(input.startDate) ? input.startDate : "";
        const endDate = input.endDate === null || input.endDate === "" ? null :
          typeof input.endDate === "string" && validDateKey(input.endDate) ? input.endDate : undefined;
        if (!startDate || endDate === undefined || (endDate && endDate < startDate)) {
          return NextResponse.json({ error: "Revisá las fechas de la regla." }, { status: 400 });
        }
        const intervalDays = input.frequency === "custom" && Number.isInteger(input.intervalDays) && Number(input.intervalDays) >= 1 && Number(input.intervalDays) <= 365 ? Number(input.intervalDays) : null;
        if (input.frequency === "custom" && intervalDays === null) return NextResponse.json({ error: "El intervalo debe estar entre 1 y 365 días." }, { status: 400 });
        const scheduleDay = input.frequency === "monthly" && Number.isInteger(input.scheduleDay) && Number(input.scheduleDay) >= 1 && Number(input.scheduleDay) <= 31 ? Number(input.scheduleDay) : null;
        const category = typeof input.category === "string" ? input.category.trim().slice(0, 60) : "";
        if (!category) return NextResponse.json({ error: "Elegí una categoría." }, { status: 400 });
        const { data: goal, error: goalError } = await supabase.from("financial_goals")
          .select("currency").eq("id", input.goalId).eq("user_id", userId).maybeSingle();
        if (goalError) throw goalError;
        if (!goal) return NextResponse.json({ error: "No encontré ese objetivo." }, { status: 404 });
        recurringGoalCurrency = goal.currency;
        const ruleCurrency = typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : goal.currency;
        const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
        if (accountId) {
          const access = await requirePremium(supabase, userId);
          if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
          const { data: account, error: accountError } = await supabase.from("financial_accounts")
            .select("id, currency, is_archived").eq("id", accountId).eq("user_id", userId).maybeSingle();
          if (accountError) throw accountError;
          if (!account || account.is_archived || account.currency !== ruleCurrency) {
            return NextResponse.json({ error: "La cuenta debe usar la misma moneda de la regla." }, { status: 400 });
          }
        }
        updates.type = input.type; updates.amount = input.amount; updates.currency = ruleCurrency; updates.category = category;
        updates.description = typeof input.description === "string" && input.description.trim() ? input.description.trim().slice(0, 240) : null;
        updates.frequency = input.frequency; updates.interval_days = intervalDays; updates.schedule_day = scheduleDay;
        const { data: currentRule, error: currentRuleError } = await supabase
          .from("financial_goal_recurring_rules")
          .select("next_run_date")
          .eq("id", input.ruleId).eq("goal_id", input.goalId).eq("user_id", userId).maybeSingle();
        if (currentRuleError) throw currentRuleError;
        if (!currentRule) return NextResponse.json({ error: "No encontré esa regla recurrente." }, { status: 404 });
        const nextRunDate = currentRule.next_run_date && currentRule.next_run_date > startDate
          ? currentRule.next_run_date : startDate;
        updates.start_date = startDate; updates.end_date = endDate; updates.next_run_date = nextRunDate; updates.mode = input.mode;
        updates.account_id = accountId;
      }
      if (!Object.keys(updates).length) return NextResponse.json({ error: "No hay cambios válidos." }, { status: 400 });
      updates.updated_at = new Date().toISOString();
      let updatedRule = await supabase.from("financial_goal_recurring_rules").update(updates)
        .eq("id", input.ruleId).eq("goal_id", input.goalId).eq("user_id", userId)
        .select("id, goal_id, currency, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").maybeSingle();
      if (updatedRule.error && (updatedRule.error.code === "42703" || updatedRule.error.code === "PGRST204") && (updates.currency === undefined || (recurringGoalCurrency !== null && updates.currency === recurringGoalCurrency))) {
        const legacyUpdates = { ...updates };
        delete legacyUpdates.currency;
        delete legacyUpdates.account_id;
        const legacyUpdatedRule = await supabase.from("financial_goal_recurring_rules").update(legacyUpdates)
          .eq("id", input.ruleId).eq("goal_id", input.goalId).eq("user_id", userId)
          .select("id, goal_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").maybeSingle();
        if (legacyUpdatedRule.error) throw legacyUpdatedRule.error;
        if (legacyUpdatedRule.data) {
          return NextResponse.json({ rule: { ...legacyUpdatedRule.data, currency: recurringGoalCurrency ?? "ARS", account_id: null } });
        }
      }
      if (updatedRule.error) throw updatedRule.error;
      if (!updatedRule.data) return NextResponse.json({ error: "No encontré esa regla recurrente." }, { status: 404 });
      return NextResponse.json({ rule: updatedRule.data });
    }

    if (typeof input.id !== "string") return NextResponse.json({ error: "El objetivo no es válido." }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (typeof input.status === "string" && ["active", "paused", "completed"].includes(input.status)) {
      if (input.status === "completed") {
        const { data: goal, error: goalError } = await supabase.from("financial_goals")
          .select("id, target_amount, currency").eq("id", input.id).eq("user_id", userId).maybeSingle();
        if (goalError) throw goalError;
        if (!goal) return NextResponse.json({ error: "No encontré ese objetivo." }, { status: 404 });
        const modernEntries = await supabase.from("financial_goal_movements")
          .select("type, amount, currency, status").eq("goal_id", input.id).eq("user_id", userId);
        let completionEntries: Array<{ type: string; amount: number | string; currency: string; status: string }>;
        if (modernEntries.error && (modernEntries.error.code === "42703" || modernEntries.error.code === "PGRST204")) {
          const legacyEntries = await supabase.from("financial_goal_movements")
            .select("type, amount, status").eq("goal_id", input.id).eq("user_id", userId);
          if (legacyEntries.error) throw legacyEntries.error;
          completionEntries = (legacyEntries.data ?? []).map((entry) => ({ ...entry, currency: goal.currency }));
        } else {
          if (modernEntries.error) throw modernEntries.error;
          completionEntries = (modernEntries.data ?? []).map((entry) => ({ ...entry, currency: entry.currency ?? goal.currency }));
        }
        const codes = [...new Set(completionEntries.filter((entry) => entry.currency !== goal.currency).map((entry) => entry.currency))];
        const completionRates = await getReferenceRates(goal.currency, codes);
        const completionTotal = completionEntries.reduce((sum, entry) => {
          if (entry.status !== "posted") return sum;
          const quotedRate = entry.currency === goal.currency ? 1 : completionRates?.rates?.[entry.currency];
          const factor = entry.currency === goal.currency ? 1 : typeof quotedRate === "number" && quotedRate > 0 ? 1 / quotedRate : null;
          if (factor === null || completionRates?.stale?.[entry.currency]) return sum;
          return sum + (entry.type === "income" ? 1 : -1) * Number(entry.amount) * factor;
        }, 0);
        if (completionTotal < Number(goal.target_amount)) {
          return NextResponse.json({ error: "Solo podés completar un objetivo cuando los ingresos confirmados, descontando los gastos, alcanzan el importe objetivo." }, { status: 400 });
        }
      }
      updates.status = input.status;
    }
    if (typeof input.title === "string" && input.title.trim().length > 0 && input.title.trim().length <= 80) updates.title = input.title.trim();
    if (input.targetDate === null || input.targetDate === "") updates.target_date = null;
    else if (typeof input.targetDate === "string" && validDateKey(input.targetDate)) updates.target_date = input.targetDate;
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No hay cambios válidos." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("financial_goals").update(updates)
      .eq("id", input.id).eq("user_id", userId)
      .select("id, title, target_amount, currency, target_date, status, updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No encontré ese objetivo." }, { status: 404 });
    return NextResponse.json({ goal: data });
  } catch {
    return NextResponse.json({ error: "No pude actualizar el objetivo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    }
    const input = body as { id: string; movementId?: unknown };
    if (typeof input.movementId === "string") {
      const { data, error } = await supabase.rpc("delete_goal_movement_multi_currency", {
        p_goal_movement_id: input.movementId, p_user_id: userId,
      });
      if (error) {
        const missingFunction = error.code === "42883" || error.code === "PGRST202" || /delete_goal_movement_multi_currency/i.test(error.message ?? "");
        if (!missingFunction) throw error;
        const legacy = await supabase.rpc("delete_linked_manual_goal_movement", { p_goal_movement_id: input.movementId, p_user_id: userId });
        if (legacy.error) throw legacy.error;
        if (!legacy.data) return NextResponse.json({ error: "No encontré ese movimiento manual." }, { status: 404 });
        return NextResponse.json({ success: true });
      }
      if (!data) return NextResponse.json({ error: "No encontré ese movimiento manual." }, { status: 404 });
      return NextResponse.json({ success: true });
    }
    const { error } = await supabase.from("financial_goals").delete().eq("id", input.id).eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "No pude eliminar el objetivo o el movimiento." }, { status: 500 });
  }
}
