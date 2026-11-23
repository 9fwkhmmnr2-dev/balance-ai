import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 999999999999;
}

export async function GET(request: Request) {
  try {
    const auth = await getUserClient(request);
    if ("error" in auth) return auth.error;
    const { supabase, userId } = auth;

    const { data: goals, error: goalsError } = await supabase
      .from("financial_goals")
      .select("id, title, target_amount, currency, target_date, status, created_at, updated_at")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (goalsError) throw goalsError;

    const ids = (goals ?? []).map((goal) => goal.id);
    let entries: { id: string; goal_id: string; amount: number; note: string | null; contributed_at: string; created_at: string }[] = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from("financial_goal_contributions")
        .select("id, goal_id, amount, note, contributed_at, created_at")
        .eq("user_id", userId)
        .in("goal_id", ids)
        .order("contributed_at", { ascending: false });
      if (error) throw error;
      entries = (data ?? []) as typeof entries;
    }

    const result = (goals ?? []).map((goal) => {
      const contributions = entries.filter((entry) => entry.goal_id === goal.id);
      const saved = contributions.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const target = Number(goal.target_amount);
      return {
        ...goal,
        target_amount: target,
        saved_amount: saved,
        remaining_amount: Math.max(0, target - saved),
        progress_percent: Math.min(100, Math.round((saved / target) * 1000) / 10),
        contributions,
      };
    });

    return NextResponse.json({ goals: result });
  } catch {
    return NextResponse.json({ error: "No pude cargar tus objetivos." }, { status: 500 });
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

    if (input.action === "contribute") {
      if (typeof input.goalId !== "string" || !validAmount(input.amount)) {
        return NextResponse.json({ error: "Revisá el objetivo y el importe del aporte." }, { status: 400 });
      }
      const { data: goal, error: goalError } = await supabase
        .from("financial_goals")
        .select("id, status")
        .eq("id", input.goalId)
        .eq("user_id", userId)
        .maybeSingle();
      if (goalError) throw goalError;
      if (!goal || goal.status !== "active") return NextResponse.json({ error: "El objetivo no existe o no está activo." }, { status: 404 });

      const note = typeof input.note === "string" ? input.note.trim().slice(0, 240) : "";
      const contributedAt = typeof input.contributedAt === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(input.contributedAt)
        ? input.contributedAt
        : new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("financial_goal_contributions")
        .insert({ goal_id: input.goalId, user_id: userId, amount: input.amount, note: note || null, contributed_at: contributedAt })
        .select("id, goal_id, amount, note, contributed_at, created_at")
        .single();
      if (error) throw error;
      return NextResponse.json({ contribution: data }, { status: 201 });
    }

    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 80 || !validAmount(input.targetAmount) || !validCurrency(input.currency)) {
      return NextResponse.json({ error: "Completá un nombre, un importe válido y una moneda admitida." }, { status: 400 });
    }
    const targetDate = input.targetDate === null || input.targetDate === "" || input.targetDate === undefined
      ? null
      : typeof input.targetDate === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(input.targetDate)
        ? input.targetDate
        : undefined;
    if (targetDate === undefined) return NextResponse.json({ error: "La fecha objetivo no es válida." }, { status: 400 });

    const { data, error } = await supabase
      .from("financial_goals")
      .insert({ user_id: userId, title, target_amount: input.targetAmount, currency: input.currency, target_date: targetDate })
      .select("id, title, target_amount, currency, target_date, status, created_at")
      .single();
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
    if (typeof input.id !== "string") return NextResponse.json({ error: "El objetivo no es válido." }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (typeof input.status === "string" && ["active", "paused", "completed"].includes(input.status)) updates.status = input.status;
    if (typeof input.title === "string" && input.title.trim().length > 0 && input.title.trim().length <= 80) updates.title = input.title.trim();
    if (input.targetDate === null || input.targetDate === "") updates.target_date = null;
    else if (typeof input.targetDate === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(input.targetDate)) updates.target_date = input.targetDate;
    if (!Object.keys(updates).length) return NextResponse.json({ error: "No hay cambios válidos." }, { status: 400 });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from("financial_goals")
      .update(updates).eq("id", input.id).eq("user_id", userId)
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
    const input = body as { id: string; contributionId?: unknown };
    if (typeof input.contributionId === "string") {
      const { error } = await supabase.from("financial_goal_contributions")
        .delete().eq("id", input.contributionId).eq("goal_id", input.id).eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    const { error } = await supabase.from("financial_goals")
      .delete().eq("id", input.id).eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "No pude eliminar el objetivo o el aporte." }, { status: 500 });
  }
}
