import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";

export async function checkVeraAiEligibility(supabase: SupabaseClient<any, "public">, userId: string) {
  // Gemini stays fail-closed until an adult account owner has confirmed a paid processing setup that permits financial data.
  if (process.env.VERA_GEMINI_PAID_DATA_PROCESSING_APPROVED !== "true") {
    return { allowed: false as const, status: 503, error: "VERA está temporalmente deshabilitada mientras se verifica la habilitación del proveedor de IA." };
  }
  const { data, error } = await supabase
    .from("registration_acceptances")
    .select("age_eligible, ai_data_consent, terms_version, privacy_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { allowed: false as const, status: 503, error: "No pudimos verificar los permisos de privacidad de VERA." };
  if (!data || data.age_eligible !== true || data.terms_version !== TERMS_VERSION || data.privacy_version !== PRIVACY_VERSION) return { allowed: false as const, status: 403, error: "Actualizá tu aceptación de edad, términos y privacidad para utilizar VERA." };
  if (data.ai_data_consent !== true) return { allowed: false as const, status: 403, error: "Necesitás autorizar el procesamiento de datos por proveedores de IA para utilizar VERA." };
  return { allowed: true as const };
}
