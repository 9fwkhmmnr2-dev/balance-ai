import type { SupabaseClient } from "@supabase/supabase-js";

export type FinancePlan = "free" | "premium";

/**
 * Server-side source of truth for FINANCE FREE / FINANCE PLUS.
 * The database keeps the legacy-compatible value "premium"; the UI names it FINANCE PLUS.
 * A cancelled subscription remains active only until its recorded expiry date.
 */
export async function getFinancePlanAccess(
  supabase: SupabaseClient<any, "public">,
  userId: string,
): Promise<{ plan: FinancePlan; isPlus: boolean }> {
  const { data, error } = await supabase
    .from("user_plan_subscriptions")
    .select("plan,status,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const expiresAt = data?.expires_at ? Date.parse(data.expires_at) : null;
  const hasValidExpiry = expiresAt === null || (Number.isFinite(expiresAt) && expiresAt > Date.now());
  const activeStatus = data?.status === "active" ||
    (data?.status === "cancelled" && expiresAt !== null && Number.isFinite(expiresAt) && expiresAt > Date.now());
  const isPlus = data?.plan === "premium" && activeStatus && hasValidExpiry;

  return { plan: isPlus ? "premium" : "free", isPlus };
}
