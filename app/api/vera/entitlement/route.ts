import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFinancePlanAccess } from "@/lib/server/gold-access";

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

  try {
    const planAccess = await getFinancePlanAccess(supabase, data.user.id);
    const isPreview = process.env.VERCEL_ENV === "preview";
    return NextResponse.json({
      plan: planAccess.plan,
      isPlus: planAccess.isPlus,
      accountId: data.user.id,
      previewOnly: isPreview,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No pudimos verificar tu plan. Intentá nuevamente." }, { status: 503 });
  }
}
