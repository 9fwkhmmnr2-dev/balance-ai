import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURRENCY_CODE = /^[A-Z]{3}$/;

type ProviderResponse = {
  result?: string;
  code?: string;
  message?: string;
  base?: string;
  source?: string;
  sources?: Record<string, string>;
  timestamp?: string;
  data_updated_at?: string;
  effective_at?: Record<string, string>;
  rates?: Record<string, number>;
  stale?: Record<string, boolean>;
  derived_symbols?: string[];
  notice?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = (searchParams.get("base") ?? "").toUpperCase();
  const symbols = (searchParams.get("symbols") ?? "").toUpperCase().split(",").filter(Boolean);
  if (!CURRENCY_CODE.test(base) || !symbols.length || symbols.length > 20 || symbols.some((code) => !CURRENCY_CODE.test(code))) {
    return NextResponse.json({ error: "Indicá una moneda de origen y hasta 20 monedas de destino válidas." }, { status: 400 });
  }
  if (symbols.includes(base)) {
    return NextResponse.json({ error: "La moneda de origen y destino deben ser distintas." }, { status: 400 });
  }

  const url = new URL(`https://api.exchangerate.dev/v1/latest/${base}`);
  url.searchParams.set("symbols", symbols.join(","));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EXCHANGERATE_API_KEY) headers.Authorization = `Bearer ${process.env.EXCHANGERATE_API_KEY}`;

  try {
    const response = await fetch(url.toString(), {
      headers,
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json() as ProviderResponse;
    if (!response.ok || payload.result !== "success" || !payload.rates) {
      const message = payload.code === "unsupported_base"
        ? `El proveedor todavía no ofrece ${base} como moneda de origen.`
        : payload.code === "quota_exceeded" || payload.code === "ip_rate_limited"
          ? "Se alcanzó temporalmente el límite de consultas del proveedor. Intentá más tarde."
          : "El proveedor internacional no pudo devolver esta cotización.";
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 }, { headers: { "Cache-Control": "no-store" } });
    }
    const availableRates: Record<string, number> = {};
    const availableStale: Record<string, boolean> = {};
    for (const code of symbols) {
      const rate = payload.rates[code];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        availableRates[code] = rate;
        availableStale[code] = payload.stale?.[code] === true;
      }
    }
    return NextResponse.json({
      provider: "ExchangeRate.dev",
      providerUrl: "https://exchangerate.dev/",
      base,
      rates: availableRates,
      source: payload.source ?? "indicative",
      sources: payload.sources ?? {},
      timestamp: payload.timestamp ?? null,
      data_updated_at: payload.data_updated_at ?? null,
      effective_at: payload.effective_at ?? {},
      stale: availableStale,
      derived_symbols: payload.derived_symbols ?? [],
      notice: payload.notice ?? "Cotizaciones indicativas, no aptas para liquidación.",
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "No pudimos consultar el proveedor internacional. Intentá nuevamente más tarde." }, { status: 503 });
  }
}
