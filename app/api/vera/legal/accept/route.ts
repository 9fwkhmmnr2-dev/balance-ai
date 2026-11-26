import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
    if (!token) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 });

    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "La sesión venció. Volvé a ingresar." }, { status: 401 });

    const body = await request.json() as { acceptedTerms?: unknown; acceptedPrivacy?: unknown };
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) {
      return NextResponse.json({ error: "Tenés que aceptar los Términos y la Política de Privacidad de VERA." }, { status: 400 });
    }

    const { data, error } = await client
      .from("registration_acceptances")
      .update({
        vera_terms_version: VERA_TERMS_VERSION,
        vera_privacy_version: VERA_PRIVACY_VERSION,
        vera_accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user.id)
      .select("user_id")
      .maybeSingle();

    if (error) {
      console.error("[VERA_LEGAL_ACCEPTANCE]", { code: error.code ?? null, message: error.message?.slice(0, 180) ?? null });
      return NextResponse.json({ error: "No pudimos guardar tu aceptación. Intentá nuevamente." }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "No encontramos tu aceptación general de FINANCE.TRACK. Volvé a completar ese paso." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos completar la aceptación." }, { status: 400 });
  }
}
