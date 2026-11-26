import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_CONSENT_VERSION, MINIMUM_AGE_YEARS, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdult(birthDate: unknown) {
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = Object.fromEntries(parts.map(part => [part.type, part.value]));
  let age = Number(today.year) - year;
  if (Number(today.month) < month || (Number(today.month) === month && Number(today.day) < day)) age--;
  return age >= MINIMUM_AGE_YEARS;
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "No pudimos verificar el registro en este momento." }, { status: 503 });
    }

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "La sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await request.json() as {
      birthDate?: unknown; acceptedTerms?: unknown; acceptedPrivacy?: unknown; aiDataConsent?: unknown;
    };
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) {
      return NextResponse.json({ error: "Tenés que aceptar los Términos y la Política de Privacidad para continuar." }, { status: 400 });
    }
    if (!isAdult(body.birthDate)) {
      return NextResponse.json({ error: "FINANCE.TRACK está disponible únicamente para personas de 18 años o más." }, { status: 403 });
    }
    if (typeof body.aiDataConsent !== "boolean") {
      return NextResponse.json({ error: "Indicá si autorizás el procesamiento de datos por los servicios de IA de VERA." }, { status: 400 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.from("registration_acceptances").upsert({
      user_id: auth.user.id,
      age_eligible: true,
      minimum_age_years: MINIMUM_AGE_YEARS,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      ai_data_consent: body.aiDataConsent,
      ai_consent_version: body.aiDataConsent ? AI_CONSENT_VERSION : null,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      console.error("[LEGAL_ACCEPTANCE_DIAGNOSTIC]", { code: error.code ?? null, message: typeof error.message === "string" ? error.message.slice(0, 240) : null, details: typeof error.details === "string" ? error.details.slice(0, 240) : null, hint: typeof error.hint === "string" ? error.hint.slice(0, 160) : null });
      return NextResponse.json({ error: "No pudimos guardar tu aceptación. Intentá nuevamente." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos completar el registro." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 });
    const authClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "La sesión venció." }, { status: 401 });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error } = await admin.from("registration_acceptances").update({ ai_data_consent: false, ai_consent_version: null, updated_at: new Date().toISOString() }).eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: "No pudimos actualizar tu preferencia." }, { status: 503 });
    return NextResponse.json({ ok: true, aiDataConsent: false });
  } catch {
    return NextResponse.json({ error: "No pudimos actualizar tu preferencia." }, { status: 400 });
  }
}
