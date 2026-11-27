import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVACY_VERSION, TERMS_VERSION, VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";

export async function checkVeraAiEligibility(supabase: SupabaseClient<any, "public">, userId: string) {
  // Personal financial context may be processed by the configured AI provider only
  // after the account passes the adult-eligibility, legal-version, and explicit AI-consent checks.
  const { data, error } = await supabase
    .from("registration_acceptances")
    .select("age_eligible, ai_data_consent, terms_version, privacy_version, vera_terms_version, vera_privacy_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { allowed: false as const, status: 503, error: "No pudimos verificar los permisos de privacidad de VERA. Intentá nuevamente." };
  if (!data) return { allowed: false as const, status: 403, error: "La cuenta todavía no tiene un registro de aceptación legal." };
  if (data.age_eligible !== true) return { allowed: false as const, status: 403, error: "VERA está disponible únicamente para cuentas cuya persona titular tenga 18 años o más y complete la verificación de edad desde Configuración." };
  if (data.terms_version !== TERMS_VERSION || data.privacy_version !== PRIVACY_VERSION) return { allowed: false as const, status: 403, error: "Actualizá los términos y la política de privacidad generales desde Configuración." };
  if (data.vera_terms_version !== VERA_TERMS_VERSION || data.vera_privacy_version !== VERA_PRIVACY_VERSION) return { allowed: false as const, status: 403, error: "Ingresá a VERA y aceptá sus Términos y Política de Privacidad para continuar." };
  if (data.ai_data_consent !== true) return { allowed: false as const, status: 403, error: "La persona titular debe autorizar el procesamiento de datos mediante proveedores de IA para utilizar VERA." };
  return { allowed: true as const };
}
