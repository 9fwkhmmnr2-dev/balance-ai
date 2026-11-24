import { NextResponse } from "next/server";

export const revalidate = 86_400;

const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=cca2,name,translations,currencies";

type CountryRecord = { cca2?: unknown; name?: { common?: unknown }; translations?: { spa?: { common?: unknown } }; currencies?: Record<string, { name?: unknown; symbol?: unknown }> };

export async function GET() {
  try {
    const response = await fetch(COUNTRIES_URL, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Country catalog unavailable");
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid country catalog");
    const countries = (payload as CountryRecord[]).flatMap((item) => {
      const code = typeof item.cca2 === "string" ? item.cca2.toUpperCase() : "";
      const name = typeof item.translations?.spa?.common === "string" ? item.translations.spa.common : typeof item.name?.common === "string" ? item.name.common : "";
      if (!/^[A-Z]{2}$/.test(code) || !name) return [];
      const currencies = Object.entries(item.currencies ?? {}).map(([currencyCode, value]) => ({
        code: currencyCode,
        name: typeof value?.name === "string" ? value.name : currencyCode,\n        symbol: typeof value?.symbol === "string" ? value.symbol : "",
      })).filter((currency) => /^[A-Z]{3}$/.test(currency.code));
      return [{ code, name, currencies }];
    }).sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (!countries.length) throw new Error("Empty country catalog");
    return NextResponse.json({ countries, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el catálogo de países." }, { status: 503 });
  }
}
