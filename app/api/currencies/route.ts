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
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

// Intl is the local safety net: the selector never depends exclusively on a remote API.
function getIntlCatalog(): CurrencyOption[] {
  try {
    return Intl.supportedValuesOf("currency")
      .filter((code) => /^[A-Z]{3}$/.test(code) && !NON_FIAT_CODES.has(code))
      .map((code) => {
        const parts = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: code,
          currencyDisplay: "narrowSymbol",
        }).formatToParts(1);
        const symbol = parts.find((part) => part.type === "currency")?.value ?? code;
        return {
          code,
          name: localizedName(code, code),
          symbol,
          numericCode: null,
          decimals: getDecimals(code),
        };
      });
  } catch {
    return [];
  }
}

function normalizeProviderCurrencies(payload: unknown): CurrencyOption[] {
  if (!Array.isArray(payload)) return [];
  return (payload as ProviderCurrency[])
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
        numericCode: typeof item.numeric === "string" && /^\d{3}$/.test(item.numeric) ? item.numeric : null,
        decimals: getDecimals(code),
      };
    });
}

export async function GET() {
  const localCatalog = getIntlCatalog();
  let providerCatalog: CurrencyOption[] = [];
  let providerAvailable = false;

  try {
    const response = await fetch(CURRENCY_CATALOG_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      providerCatalog = normalizeProviderCurrencies(await response.json());
      providerAvailable = providerCatalog.length > 0;
    }
  } catch {
    // Keep the local ISO/Intl catalog available when the provider is offline.
  }

  const merged = new Map<string, CurrencyOption>();
  for (const currency of localCatalog) merged.set(currency.code, currency);
  for (const currency of providerCatalog) {
    const local = merged.get(currency.code);
    merged.set(currency.code, {
      ...local,
      ...currency,
      name: local?.name && local.name !== currency.code ? local.name : currency.name,
      symbol: currency.symbol || local?.symbol || currency.code,
    });
  }

  const currencies = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
  return NextResponse.json({
    source: providerAvailable ? "ISO 4217 + Intl" : "Intl local fallback",
    fetchedAt: new Date().toISOString(),
    currencies,
    fallback: !providerAvailable,
  });
}
