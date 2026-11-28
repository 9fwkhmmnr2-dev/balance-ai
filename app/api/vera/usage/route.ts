import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkVeraAiEligibility } from "@/lib/server/vera-ai-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "El servicio no está configurado." }, { status: 503 });

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const eligibility = await checkVeraAiEligibility(supabase, data.user.id);
  if (!eligibility.allowed) return NextResponse.json({ error: eligibility.error }, { status: eligibility.status });

  const { data: usage, error: usageError } = await supabase.rpc("get_vera_message_credits");
  if (usageError || !usage) {
    console.error("[VERA_USAGE_READ_FAILED]");
    return NextResponse.json({ error: "No pudimos consultar tus créditos de VERA." }, { status: 503 });
  }

  return NextResponse.json({ usage }, { headers: { "Cache-Control": "no-store" } });
}
