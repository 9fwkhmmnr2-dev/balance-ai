import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 21600;

const COUNTRIES = new Set(["ARG", "BRA", "CHL", "URY", "PRY", "USA", "CAN", "MEX", "ESP", "DEU", "FRA", "GBR", "JPN", "CHN", "IND", "ZAF", "AUS"]);
const INDICATORS = [
  { id: "growth", code: "NY.GDP.MKTP.KD.ZG", label: "Crecimiento del PIB", unit: "% anual", description: "Variación anual de la producción económica." },
  { id: "inflation", code: "FP.CPI.TOTL.ZG", label: "Inflación", unit: "% anual", description: "Variación anual del índice de precios al consumidor." },
  { id: "unemployment", code: "SL.UEM.TOTL.ZS", label: "Desempleo", unit: "% de la fuerza laboral", description: "Estimación modelada de desempleo." },
  { id: "marketCap", code: "CM.MKT.LCAP.GD.ZS", label: "Capitalización bursátil", unit: "% del PIB", description: "Tamaño del mercado accionario respecto de la economía." },
] as const;

type WorldBankRow = { date?: string; value?: number | null };
type MetricResult = {
  id: string; code: string; label: string; unit: string; description: string;
  value: number | null; year: string | null; history: Array<{ year: string; value: number }>;
};

async function loadIndicator(country: string, indicator: typeof INDICATORS[number]): Promise<MetricResult> {
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator.code}?format=json&mrv=8&per_page=8`;
  const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("No se pudo consultar un indicador económico.");
  const payload: unknown = await response.json();
  const rows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] as WorldBankRow[] : [];
  const history = rows
    .filter((row): row is { date: string; value: number } => typeof row.date === "string" && typeof row.value === "number" && Number.isFinite(row.value))
    .map((row) => ({ year: row.date, value: row.value }))
    .sort((a, b) => Number(a.year) - Number(b.year));
  const latest = history[history.length - 1];
  return {
    ...indicator,
    value: latest?.value ?? null,
    year: latest?.year ?? null,
    history,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = (searchParams.get("country") ?? "ARG").toUpperCase();
  if (!COUNTRIES.has(country)) {
    return NextResponse.json({ error: "Seleccioná un país disponible." }, { status: 400 });
  }

  try {
    const metrics = await Promise.all(INDICATORS.map((indicator) => loadIndicator(country, indicator)));
    return NextResponse.json({
      country,
      provider: "Banco Mundial · World Development Indicators",
      providerUrl: "https://data.worldbank.org/",
      fetchedAt: new Date().toISOString(),
      frequency: "Anual",
      metrics,
      notice: "Los indicadores macroeconómicos se publican con rezago y pueden revisarse. No son cotizaciones en tiempo real ni recomendaciones de inversión.",
    }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "No pudimos consultar los indicadores económicos. Probá nuevamente más tarde." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
