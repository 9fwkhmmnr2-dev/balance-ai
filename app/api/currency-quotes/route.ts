import { NextResponse } from "next/server";

export const revalidate = 60;

type ProviderQuote = {
  currency?: string;
  name?: string;
  origin?: string;
  buy?: number;
  sell?: number;
  updatedAt?: string;
  lastScrapedAt?: string;
  valueType?: string;
};

const PAIRS = [
  { id: "oficial", currency: "USD", origin: "OFICIAL", label: "Dólar oficial" },
  { id: "mep", currency: "USD", origin: "BOLSA", label: "Dólar MEP" },
  { id: "blue", currency: "USD", origin: "BLUE", label: "Dólar blue" },
  { id: "euro", currency: "EUR", origin: "BNA", label: "Euro oficial" },
] as const;

function isValidQuote(value: ProviderQuote): boolean {
  return (
    typeof value.buy === "number" &&
    Number.isFinite(value.buy) &&
    value.buy > 0 &&
    typeof value.sell === "number" &&
    Number.isFinite(value.sell) &&
    value.sell > 0 &&
    typeof value.lastScrapedAt === "string" &&
    Number.isFinite(Date.parse(value.lastScrapedAt))
  );
}

function isEuroMarketClosed(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  return values.weekday === "Sat" || values.weekday === "Sun" || minutes < 540 || minutes >= 1020;
}

export async function GET() {
  try {
    const response = await fetch("https://monedapi.ar/api/v2/quotes", {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "El proveedor de cotizaciones no está disponible temporalmente." },
        { status: 502 }
      );
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return NextResponse.json(
        { error: "El proveedor devolvió un formato inesperado." },
        { status: 502 }
      );
    }

    const allQuotes = payload as ProviderQuote[];
    const now = Date.now();

    const quotes = PAIRS.map((pair) => {
      const match = allQuotes.find(
        (item) =>
          item.currency?.toUpperCase() === pair.currency &&
          item.origin?.toUpperCase() === pair.origin
      );

      if (!match || !isValidQuote(match)) return null;

      const lastConfirmedAt = Date.parse(match.lastScrapedAt!);
      const ageMinutes = Math.max(0, (now - lastConfirmedAt) / 60000);
      const marketClosed = pair.id === "euro" && isEuroMarketClosed(new Date(now));

      return {
        id: pair.id,
        name: pair.label,
        currency: pair.currency,
        buy: match.buy,
        sell: match.sell,
        updatedAt: match.updatedAt ?? null,
        lastScrapedAt: match.lastScrapedAt,
        // Outside Banco Nación's trading hours, an unchanged quote can remain valid.
        // Reapply the 15-minute freshness check as soon as the market reopens.
        stale: ageMinutes > 15 && !marketClosed,
        marketClosed,
      };
    }).filter((quote) => quote !== null);

    return NextResponse.json({
      provider: "MonedAPI",
      providerUrl: "https://monedapi.ar/",
      checkedAt: new Date(now).toISOString(),
      quotes,
    });
  } catch {
    return NextResponse.json(
      { error: "No pudimos consultar las cotizaciones. Intentá nuevamente más tarde." },
      { status: 503 }
    );
  }
}
