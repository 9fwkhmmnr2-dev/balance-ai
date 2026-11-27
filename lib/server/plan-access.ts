import type { SupabaseClient } from "@supabase/supabase-js";

export type UserPlan = "free" | "premium";

export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<{ plan: UserPlan; active: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("user_plan_subscriptions")
    .select("plan, status, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      plan: "free",
      active: false,
      error: "No pudimos verificar tu plan. Probá nuevamente más tarde."
    };
  }

  if (!data || data.plan !== "premium" || data.status !== "active") {
    return { plan: "free", active: false };
  }

  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : null;
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
    return { plan: "free", active: false };
  }

  return { plan: "premium", active: true };
}

export async function requirePremium(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: true } | { allowed: false; status: 403 | 503; error: string }> {
  const result = await getUserPlan(supabase, userId);
  if (result.error) {
    return { allowed: false, status: 503, error: result.error };
  }
  if (!result.active) {
    return {
      allowed: false,
      status: 403,
      error: "Vincular cuentas a movimientos de objetivos es una función Premium."
    };
  }
  return { allowed: true };
}
