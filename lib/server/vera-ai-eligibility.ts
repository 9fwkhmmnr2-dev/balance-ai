import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVACY_VERSION, TERMS_VERSION, VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";

export async function checkVeraAiEligibility(supabase: SupabaseClient<any, "public">, userId: string) {
  // Free-tier Gemini is restricted to allowlisted general-knowledge prompts.
  // Personal financial analysis is handled locally and is never sent to Gemini.
  const { data, error } = await supabase
    .from("registration_acceptances")
    .select("age_eligible, ai_data_consent, terms_version, privacy_version, vera_terms_version, vera_privacy_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { allowed: false as const, status: 503, error: "No pudimos verificar los permisos de privacidad de VERA." };
  if (!data || data.age_eligible !== true || data.terms_version !== TERMS_VERSION || data.privacy_version !== PRIVACY_VERSION) return { allowed: false as const, status: 403, error: "Actualizá tu aceptación de edad, términos y privacidad para utilizar VERA." };
  if (data.vera_terms_version !== VERA_TERMS_VERSION || data.vera_privacy_version !== VERA_PRIVACY_VERSION) return { allowed: false as const, status: 403, error: "Ingresá a VERA y aceptá sus Términos y Política de Privacidad para continuar." };
  if (data.ai_data_consent !== true) return { allowed: false as const, status: 403, error: "Necesitás autorizar el procesamiento de datos por proveedores de IA para utilizar VERA." };
  return { allowed: true as const };
}
