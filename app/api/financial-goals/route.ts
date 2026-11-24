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

function validCurrency(value: unknown): value is "ARS" | "USD" | "EUR" {
  return value === "ARS" || value === "USD" || value === "EUR";
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

function netAmount(entries: Array<{ type: string; amount: number | string; status: string }>) {
  return entries.reduce((sum, entry) => {
    if (entry.status !== "posted") return sum;
    const amount = Number(entry.amount);
    return sum + (entry.type === "income" ? amount : entry.type === "expense" ? -amount : 0);
  }, 0);
}

export async function GET(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;
    const { data: goals, error: goalsError } = await supabase
      .from("financial_goals")
      .select("id, name, target_amount, currency, deadline, status, is_archived, created_at, updated_at")
      .eq("user_id", userId).eq("is_archived", false).neq("status", "archived").order("created_at", { ascending: false });
    if (goalsError) throw goalsError;
    const { data: accounts, error: accountsError } = await supabase
      .from("financial_accounts")
      .select("id, name, currency, is_archived")
      .eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: true });
    if (accountsError) throw accountsError;

    const ids = (goals ?? []).map((goal) => goal.id);
    let movements: Array<{ id: string; goal_id: string; type: "income" | "expense"; amount: number; category: string; description: string | null; movement_date: string; status: "pending" | "posted" | "cancelled"; source: string; recurring_rule_id: string | null; verification_status: "not_required" | "pending" | "verified"; verified_at: string | null; created_at: string }> = [];
    let rules: Array<{ id: string; goal_id: string; account_id: string | null; type: "income" | "expense"; amount: number; category: string; description: string | null; frequency: string; interval_days: number | null; schedule_day: number | null; start_date: string; end_date: string | null; next_run_date: string; mode: "confirmation" | "automatic"; status: string }> = [];
    if (ids.length) {
      const [movementResult, ruleResult] = await Promise.all([
        supabase.from("financial_goal_movements")
          .select("id, goal_id, type, amount, category, description, movement_date, status, source, recurring_rule_id, verification_status, verified_at, created_at")
          .eq("user_id", userId).in("goal_id", ids).order("movement_date", { ascending: false }),
        supabase.from("financial_goal_recurring_rules")
          .select("id, goal_id, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status")
          .eq("user_id", userId).in("goal_id", ids).order("next_run_date", { ascending: true }),
      ]);
      let ruleRows = ruleResult.data ?? [];
      if (ruleResult.error) {
        const missingAccountColumn = ruleResult.error.code === "42703" ||
          ruleResult.error.code === "PGRST204" ||
          ruleResult.error.message?.includes("account_id");
        if (!missingAccountColumn) throw ruleResult.error;
        const fallbackRules = await supabase.from("financial_goal_recurring_rules")
          .select("id, goal_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status")
          .eq("user_id", userId).in("goal_id", ids).order("next_run_date", { ascending: true });
        if (fallbackRules.error) throw fallbackRules.error;
        ruleRows = (fallbackRules.data ?? []).map((rule) => ({ ...rule, account_id: null }));
      }
      if (movementResult.error) {
        const missingVerificationColumns = movementResult.error.code === "42703" ||
          movementResult.error.code === "PGRST204" ||
          movementResult.error.message?.includes("verification_status") ||
          movementResult.error.message?.includes("verified_at");
        if (!missingVerificationColumns) throw movementResult.error;
        // Preview puede seguir usando el esquema compartido anterior hasta aplicar la migración en una base aislada.
        const fallbackResult = await supabase.from("financial_goal_movements")
          .select("id, goal_id, type, amount, category, description, movement_date, status, source, recurring_rule_id, created_at")
          .eq("user_id", userId).in("goal_id", ids).order("movement_date", { ascending: false });
        if (fallbackResult.error) throw fallbackResult.error;
        movements = (fallbackResult.data ?? []).map((entry) => ({
          ...entry, verification_status: "not_required" as const, verified_at: null,
        })) as typeof movements;
      } else {
        movements = (movementResult.data ?? []) as typeof movements;
      }
      rules = ruleRows as typeof rules;
    }

    const result = (goals ?? []).map((goal) => {
      const goalMovements = movements.filter((entry) => entry.goal_id === goal.id);
      const posted = goalMovements.filter((entry) => entry.status === "posted");
      const saved = netAmount(posted);
      const target = Number(goal.target_amount);
      return {
        ...goal,
        title: goal.name,
        target_date: goal.deadline,
        target_amount: target,
        saved_amount: Math.max(0, saved),
        net_amount: saved,
        remaining_amount: Math.max(0, target - saved),
        progress_percent: Math.min(100, Math.max(0, Math.round((saved / target) * 1000) / 10)),
        movements: goalMovements.map((movement) => ({
          ...movement,
          recurring_mode: rules.find((rule) => rule.id === movement.recurring_rule_id)?.mode ?? null,
        })),
        recurring_rules: rules.filter((rule) => rule.goal_id === goal.id),
      };
    });
    return NextResponse.json({ goals: result, accounts: accounts ?? [] });
  } catch {
    return NextResponse.json({ error: "No pude cargar tus objetivos. Revisá que las tablas de movimientos y reglas estén disponibles." }, { status: 500 });
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
      const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
      if (accountId) {
        const access = await requirePremium(supabase, userId);
        if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
        const { data: account, error: accountError } = await supabase.from("financial_accounts")
          .select("id, currency, is_archived").eq("id", accountId).eq("user_id", userId).maybeSingle();
        if (accountError) throw accountError;
        if (!account || account.is_archived || account.currency !== goal.currency) {
          return NextResponse.json({ error: "La cuenta debe pertenecer a tu usuario, estar activa y usar la misma moneda del objetivo." }, { status: 400 });
        }
      }
      const { data, error } = await supabase.from("financial_goal_recurring_rules").insert({
        goal_id: input.goalId, user_id: userId, type: input.type, amount: input.amount,
        category, description: description || null, frequency: input.frequency,
        interval_days: intervalDays, schedule_day: scheduleDay, start_date: startDate,
        end_date: endDate, next_run_date: startDate, mode: input.mode, status: "active",
        account_id: accountId, updated_at: new Date().toISOString(),
      }).select("id, goal_id, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").single();
      if (error) throw error;
      return NextResponse.json({ rule: data }, { status: 201 });
    }

    if (input.action === "movement") {
      if (typeof input.goalId !== "string" || !validAmount(input.amount) ||
          (input.type !== "income" && input.type !== "expense")) {
        return NextResponse.json({ error: "Revisá el objetivo, el tipo y el importe del movimiento." }, { status: 400 });
      }
      const { data: goal, error: goalError } = await supabase.from("financial_goals")
        .select("id, status").eq("id", input.goalId).eq("user_id", userId).maybeSingle();
      if (goalError) throw goalError;
      if (!goal || goal.status !== "active") return NextResponse.json({ error: "El objetivo no existe o no está activo." }, { status: 404 });
      const movementDate = typeof input.movementDate === "string" && validDateKey(input.movementDate)
        ? input.movementDate : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
      const category = typeof input.category === "string" ? input.category.trim().slice(0, 60) : "";
      if (!category) return NextResponse.json({ error: "Elegí una categoría para el movimiento." }, { status: 400 });
      const description = typeof input.description === "string" ? input.description.trim().slice(0, 240) : "";
      const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
      if (accountId) {
        const access = await requirePremium(supabase, userId);
        if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
      }
      const { data: movementId, error } = await supabase.rpc("create_linked_goal_movement", {
        p_goal_id: input.goalId,
        p_user_id: userId,
        p_type: input.type,
        p_amount: input.amount,
        p_category: category,
        p_description: description || null,
        p_movement_date: movementDate,
        p_account_id: accountId,
        p_source: "manual",
        p_recurring_rule_id: null,
        p_scheduled_for_date: null,
        p_status: "posted",
        p_verification_status: "not_required",
      });
      if (error) throw error;
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
      .insert({ user_id: userId, name: title, target_amount: input.targetAmount, currency: input.currency, deadline: targetDate })
      .select("id, name, target_amount, currency, deadline, status, created_at").single();
    if (error) throw error;
    return NextResponse.json({ goal: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No pude guardar el objetivo. Verificá que la migración esté aplicada." }, { status: 500 });
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
      const { data, error } = await supabase.rpc("correct_linked_goal_movement", {
        p_goal_movement_id: input.movementId,
        p_user_id: userId,
        p_amount: input.amount,
        p_category: input.category.trim().slice(0, 60),
        p_description: description || null,
        p_movement_date: input.movementDate,
      });
      if (error) throw error;
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
        const { data, error } = await supabase.rpc("confirm_linked_goal_movement", {
          p_goal_movement_id: input.movementId, p_user_id: userId,
        });
        if (error) throw error;
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
      if (typeof input.status === "string") {
        if (!["active", "paused", "completed"].includes(input.status)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
        updates.status = input.status;
      }
      const editing = ["type", "amount", "category", "description", "frequency", "intervalDays", "scheduleDay", "startDate", "endDate", "mode", "accountId"].some((key) => key in input);
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
        const accountId = typeof input.accountId === "string" && input.accountId ? input.accountId : null;
        if (accountId) {
          const access = await requirePremium(supabase, userId);
          if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
          const { data: account, error: accountError } = await supabase.from("financial_accounts")
            .select("id, currency, is_archived").eq("id", accountId).eq("user_id", userId).maybeSingle();
          if (accountError) throw accountError;
          if (!account || account.is_archived || account.currency !== goal.currency) {
            return NextResponse.json({ error: "La cuenta debe pertenecer a tu usuario, estar activa y usar la misma moneda del objetivo." }, { status: 400 });
          }
        }
        updates.type = input.type; updates.amount = input.amount; updates.category = category;
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
      const { data, error } = await supabase.from("financial_goal_recurring_rules").update(updates)
        .eq("id", input.ruleId).eq("goal_id", input.goalId).eq("user_id", userId)
        .select("id, goal_id, account_id, type, amount, category, description, frequency, interval_days, schedule_day, start_date, end_date, next_run_date, mode, status").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "No encontré esa regla recurrente." }, { status: 404 });
      return NextResponse.json({ rule: data });
    }

    if (typeof input.id !== "string") return NextResponse.json({ error: "El objetivo no es válido." }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (typeof input.status === "string" && ["active", "paused", "completed"].includes(input.status)) {
      if (input.status === "completed") {
        const { data: goal, error: goalError } = await supabase.from("financial_goals")
          .select("id, target_amount").eq("id", input.id).eq("user_id", userId).maybeSingle();
        if (goalError) throw goalError;
        if (!goal) return NextResponse.json({ error: "No encontré ese objetivo." }, { status: 404 });
        const { data: entries, error: entriesError } = await supabase.from("financial_goal_movements")
          .select("type, amount, status").eq("goal_id", input.id).eq("user_id", userId);
        if (entriesError) throw entriesError;
        if (netAmount(entries ?? []) < Number(goal.target_amount)) {
          return NextResponse.json({ error: "Solo podés completar un objetivo cuando los ingresos confirmados, descontando los gastos, alcanzan el importe objetivo." }, { status: 400 });
        }
      }
      updates.status = input.status;
    }
    if (typeof input.title === "string" && input.title.trim().length > 0 && input.title.trim().length <= 80) updates.name = input.title.trim();
    if (input.targetDate === null || input.targetDate === "") updates.deadline = null;
    else if (typeof input.targetDate === "string" && validDateKey(input.targetDate)) updates.deadline = input.targetDate;
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No hay cambios válidos." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("financial_goals").update(updates)
      .eq("id", input.id).eq("user_id", userId)
      .select("id, name, target_amount, currency, deadline, status, updated_at").maybeSingle();
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
      const { data, error } = await supabase.rpc("delete_linked_manual_goal_movement", {
        p_goal_movement_id: input.movementId, p_user_id: userId,
      });
      if (error) throw error;
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
