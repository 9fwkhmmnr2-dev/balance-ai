import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Tu sesión no está disponible." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "El servicio de cotizaciones no está configurado." }, { status: 503 });

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Tu sesión venció." }, { status: 401 });

  const requested = new URL(request.url).searchParams.get("symbols") || "";
  const symbols = [...new Set(requested.split(",").filter((code) => /^[A-Z]{3}$/.test(code) && code !== "ARS"))].slice(0, 12);
  if (!symbols.length) return NextResponse.json({ base: "ARS", rates: { ARS: 1 }, source: "base_currency", updatedAt: null });

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EXCHANGERATE_API_KEY) headers.Authorization = `Bearer ${process.env.EXCHANGERATE_API_KEY}`;
  try {
    const endpoint = new URL("https://api.exchangerate.dev/v1/latest/ARS");
    endpoint.searchParams.set("symbols", symbols.join(","));
    const response = await fetch(endpoint.toString(), { headers, next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) return NextResponse.json({ error: "No hay una cotización disponible en este momento." }, { status: 502 });
    const payload = await response.json() as { result?: string; rates?: Record<string, number>; source?: string; data_updated_at?: string };
    if (payload.result !== "success" || !payload.rates) return NextResponse.json({ error: "La cotización recibida no es válida." }, { status: 502 });
    return NextResponse.json({ base: "ARS", rates: payload.rates, source: payload.source ?? "exchangerate.dev", updatedAt: payload.data_updated_at ?? null });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la cotización." }, { status: 502 });
  }
}
