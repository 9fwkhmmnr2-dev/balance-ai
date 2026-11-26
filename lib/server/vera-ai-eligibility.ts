import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkVeraAiEligibility(supabase: SupabaseClient<any, "public">, userId: string) {
  // Gemini stays fail-closed until an adult account owner has reviewed and approved the provider setup.
  if (process.env.VERA_GEMINI_ADULT_OPERATOR_APPROVED !== "true") {
    return { allowed: false as const, status: 503, error: "VERA está temporalmente deshabilitada mientras se verifica la habilitación del proveedor de IA." };
  }
  const { data, error } = await supabase
    .from("registration_acceptances")
    .select("age_eligible, ai_data_consent")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { allowed: false as const, status: 503, error: "No pudimos verificar los permisos de privacidad de VERA." };
  if (!data || data.age_eligible !== true) return { allowed: false as const, status: 403, error: "Tu cuenta no cumple los requisitos de acceso de FINANCE.TRACK." };
  if (data.ai_data_consent !== true) return { allowed: false as const, status: 403, error: "Necesitás autorizar el procesamiento de datos por proveedores de IA para utilizar VERA." };
  return { allowed: true as const };
}
