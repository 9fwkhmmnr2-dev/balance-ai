import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserPlan } from "../../../lib/server/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "El servicio de planes no está configurado." }, { status: 503 });
  }

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });
  }

  const plan = await getUserPlan(supabase, data.user.id);
  if (plan.error) {
    return NextResponse.json({ error: plan.error }, { status: 503 });
  }

  return NextResponse.json({
    plan: plan.plan,
    active: plan.active
  });
}
