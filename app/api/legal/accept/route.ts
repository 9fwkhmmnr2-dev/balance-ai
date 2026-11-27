import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_CONSENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdult(birthDate: unknown) {
  if (typeof birthDate !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const beforeBirthday = now.getUTCMonth() + 1 < month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 18;
}

function clients(token: string) {
  // Prefer the current Supabase integration variables; retain legacy fallbacks for existing environments.
  const url = process.env.NEXT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverKey = process.env.NEXT_SUPABASE_SECRET_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serverKey) return null;
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { authClient, adminClient };
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    const supabase = clients(token);
    if (!supabase) return NextResponse.json({ error: "El servicio de permisos no está configurado." }, { status: 503 });

    const { data: auth, error: authError } = await supabase.authClient.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "La sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await request.json() as {
      acceptedTerms?: unknown; acceptedPrivacy?: unknown; aiDataConsent?: unknown;
      birthDate?: unknown; confirmAdult?: unknown;
    };
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) {
      return NextResponse.json({ error: "Tenés que aceptar los Términos y la Política de Privacidad." }, { status: 400 });
    }
    if (typeof body.aiDataConsent !== "boolean") {
      return NextResponse.json({ error: "Indicá tu preferencia para el procesamiento mediante IA." }, { status: 400 });
    }
    const verifiesAge = body.birthDate !== undefined;
    if (verifiesAge && (body.confirmAdult !== true || !isAdult(body.birthDate))) {
      return NextResponse.json({ error: "VERA está disponible únicamente para personas de 18 años o más. No guardamos tu fecha de nacimiento." }, { status: 403 });
    }

    const acceptedAt = new Date().toISOString();
    const acceptanceValues = {
      ...(verifiesAge ? { age_eligible: true, minimum_age_years: 18 } : {}),
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      ai_data_consent: body.aiDataConsent,
      ai_consent_version: body.aiDataConsent ? AI_CONSENT_VERSION : null,
      accepted_at: acceptedAt,
      updated_at: acceptedAt,
    };
    const { data: updated, error: updateError } = await supabase.adminClient
      .from("registration_acceptances").update(acceptanceValues)
      .eq("user_id", auth.user.id).select("user_id").maybeSingle();
    if (updateError) {
      console.error("[LEGAL_ACCEPTANCE_DIAGNOSTIC]", { code: updateError.code ?? null, message: updateError.message?.slice(0, 180) ?? null });
      return NextResponse.json({ error: "No pudimos guardar tu aceptación. Intentá nuevamente." }, { status: 503 });
    }
    if (!updated) {
      if (!verifiesAge) return NextResponse.json({ error: "No encontramos un registro de edad verificada para esta cuenta. No podemos habilitar VERA sin completar la verificación." }, { status: 409 });
      const { error: insertError } = await supabase.adminClient.from("registration_acceptances")
        .insert({ user_id: auth.user.id, ...acceptanceValues });
      if (insertError) {
        console.error("[LEGAL_ACCEPTANCE_INSERT_DIAGNOSTIC]", { code: insertError.code ?? null, message: insertError.message?.slice(0, 180) ?? null });
        return NextResponse.json({ error: "No pudimos crear el registro de aceptaciones. Intentá nuevamente." }, { status: 503 });
      }
    }
    return NextResponse.json({ ok: true, ageEligible: true });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la actualización." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    const supabase = clients(token);
    if (!supabase) return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 });
    const { data: auth, error: authError } = await supabase.authClient.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "La sesión venció." }, { status: 401 });
    const { error } = await supabase.adminClient.from("registration_acceptances")
      .update({ ai_data_consent: false, ai_consent_version: null, updated_at: new Date().toISOString() })
      .eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: "No pudimos actualizar tu preferencia." }, { status: 503 });
    return NextResponse.json({ ok: true, aiDataConsent: false });
  } catch {
    return NextResponse.json({ error: "No pudimos actualizar tu preferencia." }, { status: 400 });
  }
}
