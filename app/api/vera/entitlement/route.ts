import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isGoldEnabledForUser } from "@/lib/server/gold-access";

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

  const isPreview = process.env.VERCEL_ENV === "preview";
  return NextResponse.json({
    isGold: isGoldEnabledForUser(data.user),
    accountId: data.user.id,
    previewAccessPending: isPreview && !process.env.VERA_GOLD_PREVIEW_USER_ID,
    previewOnly: isPreview,
  }, { headers: { "Cache-Control": "no-store" } });
}
