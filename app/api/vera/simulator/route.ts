import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePremium } from "@/lib/server/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "El servicio financiero no está configurado." }, { status: 503 });

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

    const access = await requirePremium(supabase, auth.user.id);
    if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });

    const { data: profile, error: profileError } = await supabase
      .from("financial_profiles").select("currency").eq("user_id", auth.user.id).maybeSingle();
    if (profileError) throw profileError;
    const currency = typeof profile?.currency === "string" ? profile.currency : "ARS";

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setUTCDate(fromDate.getUTCDate() - 89);
    const from = fromDate.toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);

    const { data: movements, error: movementsError } = await supabase
      .from("movements")
      .select("type, amount, category, movement_date")
      .eq("user_id", auth.user.id)
      .eq("currency", currency)
      .gte("movement_date", from)
      .lte("movement_date", to)
      .order("movement_date", { ascending: true })
      .limit(5000);
    if (movementsError) throw movementsError;

    const rows = movements ?? [];
    const income = rows.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount), 0);
    const expenses = rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
    const categories = new Map<string, number>();
    rows.filter((row) => row.type === "expense").forEach((row) => {
      const name = typeof row.category === "string" && row.category.trim() ? row.category.trim() : "Sin categoría";
      categories.set(name, (categories.get(name) ?? 0) + Number(row.amount));
    });

    return NextResponse.json({
      currency, from, to, movementsCount: rows.length,
      monthlyIncome: income / 3, monthlyExpenses: expenses / 3,
      monthlyNet: (income - expenses) / 3,
      topExpenses: Array.from(categories, ([category, amount]) => ({ category, monthlyAmount: amount / 3 }))
        .sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 5),
    });
  } catch {
    return NextResponse.json({ error: "No pudimos preparar tus datos para la simulación." }, { status: 500 });
  }
}
