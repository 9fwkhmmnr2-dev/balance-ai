import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BcraQuote = { codigoMoneda?: string; descripcion?: string; tipoCotizacion?: number | string };
type BcraPayload = { status?: number; results?: { fecha?: string; detalle?: BcraQuote[] } };

function argentinaDate(offsetDays = 0) {
  const now = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function GET() {
  const supported = ["USD", "EUR", "BRL"] as const;

  for (let offset = 0; offset <= 7; offset += 1) {
    const requestedDate = argentinaDate(offset);
    try {
      const response = await fetch(
        `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=${requestedDate}`,
        { headers: { Accept: "application/json" }, next: { revalidate: 1800 } },
      );
      if (!response.ok) continue;

      const payload = await response.json() as BcraPayload;
      const details = payload.results?.detalle;
      if (!Array.isArray(details)) continue;

      const rates: Record<string, number> = {};
      for (const quote of details) {
        const code = quote.codigoMoneda;
        const value = Number(quote.tipoCotizacion);
        if (code && supported.includes(code as typeof supported[number]) && Number.isFinite(value) && value > 0) {
          rates[code] = value;
        }
      }

      if (supported.every((code) => Number.isFinite(rates[code]) && rates[code] > 0)) {
        return NextResponse.json(
          { date: payload.results?.fecha || requestedDate, source: "BCRA · Estadísticas Cambiarias", rates },
          { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
        );
      }
    } catch {
      // Try the previous business date; never fabricate a rate.
    }
  }

  return NextResponse.json(
    { error: "Las cotizaciones oficiales no están disponibles temporalmente." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
