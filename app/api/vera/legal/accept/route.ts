import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverKey =
    process.env.NEXT_SUPABASE_SECRET_KEY ||
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serverKey) return null;

  return createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: "El servicio de permisos no está configurado." }, { status: 503 });
    }

    const { data: auth, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !auth.user) {
      console.error("[VERA_LEGAL_AUTH]", { code: authError?.code ?? null, status: authError?.status ?? null });
      return NextResponse.json({ error: "No pudimos validar tu sesión. Volvé a ingresar e intentá nuevamente." }, { status: 401 });
    }

    const body = await request.json() as { acceptedTerms?: unknown; acceptedPrivacy?: unknown };
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) {
      return NextResponse.json({ error: "Tenés que aceptar los Términos y la Política de Privacidad de VERA." }, { status: 400 });
    }

    const acceptedAt = new Date().toISOString();
    const { data, error } = await adminClient.from("registration_acceptances").update({
      vera_terms_version: VERA_TERMS_VERSION,
      vera_privacy_version: VERA_PRIVACY_VERSION,
      vera_accepted_at: acceptedAt,
      updated_at: acceptedAt,
    }).eq("user_id", auth.user.id).select("user_id").maybeSingle();

    if (error) {
      console.error("[VERA_LEGAL_ACCEPTANCE]", { code: error.code ?? null, message: error.message?.slice(0, 180) ?? null });
      return NextResponse.json({ error: "No pudimos guardar tu aceptación. Intentá nuevamente." }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "No encontramos el registro de tu cuenta para actualizar los permisos." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la aceptación." }, { status: 400 });
  }
}
