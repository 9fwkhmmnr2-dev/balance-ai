import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Falta configurar el acceso seguro a Supabase." }, { status: 503 });
  }

  try {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.rpc("process_financial_goal_recurring_rules_multi_currency");
    if (error) {
      const missingFunction = error.code === "42883" || error.code === "PGRST202" || /process_financial_goal_recurring_rules_multi_currency/i.test(error.message ?? "");
      if (!missingFunction) throw error;
      const legacy = await supabase.rpc("process_financial_goal_recurring_rules");
      if (legacy.error) throw legacy.error;
      return NextResponse.json({ success: true, created_movements: Number(legacy.data ?? 0), timezone: "America/Argentina/Buenos_Aires", currency_migration_pending: true });
    }
    return NextResponse.json({
      success: true,
      created_movements: Number(data ?? 0),
      timezone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return NextResponse.json({ error: "No se pudieron procesar las reglas recurrentes." }, { status: 500 });
  }
}
