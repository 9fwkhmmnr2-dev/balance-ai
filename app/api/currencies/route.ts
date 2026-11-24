import { NextResponse } from "next/server";

export const revalidate = 86_400;

const CURRENCY_CATALOG_URL = "https://api.currency-core.com/v1/currencies";
const NON_FIAT_CODES = new Set(["XAU", "XAG", "XPT", "XPD", "XDR"]);

type ProviderCurrency = {
  code?: unknown;
  numeric?: unknown;
  name?: unknown;
  symbol?: unknown;
};

export type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
  numericCode: string | null;
  decimals: number;
};

function localizedName(code: string, fallback: string): string {
  try {
    const name = new Intl.DisplayNames(["es"], { type: "currency" }).of(code);
    return name && name !== code ? name : fallback;
  } catch {
    return fallback;
  }
}

function getDecimals(code: string): number {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function getIntlFallback(): CurrencyOption[] {
  try {
    const codes = Intl.supportedValuesOf("currency");
    return codes
      .filter((code) => /^[A-Z]{3}$/.test(code) && !NON_FIAT_CODES.has(code))
      .map((code) => {
        const parts = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: code,
          currencyDisplay: "narrowSymbol",
        }).formatToParts(1);
        const symbol = parts.find((part) => part.type === "currency")?.value ?? code;
        const name = localizedName(code, code);
        return {
          code,
          name,
          symbol,
          numericCode: null,
          decimals: getDecimals(code),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch {
    return [];
  }
}

function normalizeProviderCurrencies(payload: unknown): CurrencyOption[] {
  if (!Array.isArray(payload)) return [];

  const currencies = (payload as ProviderCurrency[])
    .filter((item) => {
      const code = typeof item.code === "string" ? item.code.toUpperCase() : "";
      return /^[A-Z]{3}$/.test(code) && !NON_FIAT_CODES.has(code);
    })
    .map((item) => {
      const code = String(item.code).toUpperCase();
      const fallbackName = typeof item.name === "string" ? item.name : code;
      return {
        code,
        name: localizedName(code, fallbackName),
        symbol: typeof item.symbol === "string" && item.symbol.trim() ? item.symbol : code,
        numericCode:
          typeof item.numeric === "string" && /^\d{3}$/.test(item.numeric)
            ? item.numeric
            : null,
        decimals: getDecimals(code),
      };
    });

  return Array.from(new Map(currencies.map((currency) => [currency.code, currency])).values())
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function GET() {
  try {
    const response = await fetch(CURRENCY_CATALOG_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error("Currency catalog provider unavailable");

    const payload: unknown = await response.json();
    const currencies = normalizeProviderCurrencies(payload);
    if (currencies.length === 0) throw new Error("Currency catalog response was invalid");

    return NextResponse.json({
      source: "CurrencyCore / ISO 4217",
      fetchedAt: new Date().toISOString(),
      currencies,
    });
  } catch {
    const currencies = getIntlFallback();
    return NextResponse.json({
      source: "Intl fallback",
      fetchedAt: new Date().toISOString(),
      currencies,
      fallback: true,
    });
  }
}
