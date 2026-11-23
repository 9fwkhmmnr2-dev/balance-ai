import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVeraProvider } from "@/lib/vera/provider";
import type { VeraMessage, VeraFinancialContext } from "@/lib/vera/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Period = "daily" | "weekly" | "monthly" | "yearly";
type MovementRow = {
  type: "income" | "expense";
  amount: number | string;
  category: string | null;
};

function buenosAiresToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startDate(period: Period, today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === "weekly") date.setUTCDate(date.getUTCDate() - 6);
  if (period === "monthly") date.setUTCDate(1);
  if (period === "yearly") {
    date.setUTCMonth(0, 1);
  }
  return date.toISOString().slice(0, 10);
}

function isPeriod(value: unknown): value is Period {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

function isMessages(value: unknown): value is VeraMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return false;
  return value.every((item) =>
    item &&
    (item.role === "user" || item.role === "model") &&
    typeof item.content === "string" &&
    item.content.trim().length > 0 &&
    item.content.length <= 3000
  ) && value[0].role === "user" && value[value.length - 1].role === "user";
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Tu sesión no está disponible. Volvé a iniciar sesión." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "El servicio financiero no está configurado." }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Tu sesión venció. Volvé a iniciar sesión." }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
    }
    const input = body as { messages?: unknown; period?: unknown };
    if (!isMessages(input.messages) || !isPeriod(input.period)) {
      return NextResponse.json({ error: "La conversación no tiene un formato válido." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("financial_profiles")
      .select("currency")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const currency = typeof profile?.currency === "string" ? profile.currency : "ARS";
    const today = buenosAiresToday();
    const from = startDate(input.period, today);
    const { data: rows, error: movementError } = await supabase
      .from("movements")
      .select("type, amount, category")
      .eq("user_id", authData.user.id)
      .eq("currency", currency)
      .gte("movement_date", from)
      .lte("movement_date", today)
      .order("movement_date", { ascending: false })
      .limit(5000);
    if (movementError) throw movementError;

    const movements = (rows ?? []) as MovementRow[];
    const income = movements
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = movements
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const categories = new Map<string, number>();
    movements.filter((item) => item.type === "expense").forEach((item) => {
      const category = item.category?.trim() || "Sin categoría";
      categories.set(category, (categories.get(category) ?? 0) + Number(item.amount));
    });

    const financialContext: VeraFinancialContext = {
      currency,
      period: input.period,
      income,
      expenses,
      netBalance: income - expenses,
      movementsCount: movements.length,
      categoryTotals: Array.from(categories, ([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    };

    const provider = getVeraProvider();
    const result = await provider.generate({
      messages: input.messages,
      financialContext,
    });

    return NextResponse.json({ reply: result.text });
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "";
    const providerHttpMatch = rawCode.match(/^VERA_PROVIDER_HTTP_(\\d{3})$/);
    const safeCode = [
      "VERA_AI_NOT_CONFIGURED",
      "VERA_PROVIDER_RATE_LIMIT",
      "VERA_EMPTY_RESPONSE",
      "VERA_PROVIDER_TIMEOUT",
      "VERA_PROVIDER_NETWORK_ERROR",
    ].includes(rawCode)
      ? rawCode
      : providerHttpMatch
        ? `GEMINI_HTTP_${providerHttpMatch[1]}`
        : "UNCLASSIFIED_SERVER_ERROR";

    // Never log API keys, authorization headers, prompts, or financial data.
    console.error("[VERA_CHAT_DIAGNOSTIC]", { code: safeCode });

    const code = rawCode;
    if (code === "VERA_AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "VERA todavía no tiene su conexión de IA configurada." }, { status: 503 });
    }
    if (code === "VERA_PROVIDER_RATE_LIMIT") {
      return NextResponse.json({ error: "Estoy recibiendo muchas consultas en este momento. Probá de nuevo en un ratito." }, { status: 429 });
    }
    if (code === "VERA_EMPTY_RESPONSE") {
      return NextResponse.json({ error: "No pude preparar una respuesta esta vez. Intentemos de nuevo." }, { status: 502 });
    }
    if (code === "VERA_PROVIDER_TIMEOUT") {
      return NextResponse.json({ error: "La conexión con VERA tardó demasiado. Probá nuevamente." }, { status: 504 });
    }
    return NextResponse.json({ error: "No pude conectar con VERA en este momento. Intentá nuevamente." }, { status: 502 });
  }
}
