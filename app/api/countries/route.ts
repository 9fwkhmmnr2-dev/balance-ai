import { NextResponse } from "next/server";

export const revalidate = 86_400;

const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=cca2,name,translations,currencies";

type CountryRecord = {
  cca2?: unknown;
  name?: { common?: unknown };
  translations?: { spa?: { common?: unknown } };
  currencies?: Record<string, { name?: unknown; symbol?: unknown }>;
};

const LOCAL_COUNTRIES = [
  ["AR", "Argentina", "ARS", "Peso argentino", "$"], ["BR", "Brasil", "BRL", "Real brasileño", "R$"],
  ["UY", "Uruguay", "UYU", "Peso uruguayo", "$U"], ["CL", "Chile", "CLP", "Peso chileno", "$"],
  ["PY", "Paraguay", "PYG", "Guaraní", "₲"], ["BO", "Bolivia", "BOB", "Boliviano", "Bs."],
  ["PE", "Perú", "PEN", "Sol peruano", "S/"], ["CO", "Colombia", "COP", "Peso colombiano", "$"],
  ["MX", "México", "MXN", "Peso mexicano", "$"], ["US", "Estados Unidos", "USD", "Dólar estadounidense", "$"],
  ["CA", "Canadá", "CAD", "Dólar canadiense", "$"], ["ES", "España", "EUR", "Euro", "€"],
  ["FR", "Francia", "EUR", "Euro", "€"], ["DE", "Alemania", "EUR", "Euro", "€"],
  ["IT", "Italia", "EUR", "Euro", "€"], ["PT", "Portugal", "EUR", "Euro", "€"],
  ["GB", "Reino Unido", "GBP", "Libra esterlina", "£"], ["CH", "Suiza", "CHF", "Franco suizo", "CHF"],
  ["JP", "Japón", "JPY", "Yen japonés", "¥"], ["CN", "China", "CNY", "Yuan chino", "¥"],
  ["AU", "Australia", "AUD", "Dólar australiano", "$"], ["NZ", "Nueva Zelanda", "NZD", "Dólar neozelandés", "$"],
  ["IN", "India", "INR", "Rupia india", "₹"], ["ZA", "Sudáfrica", "ZAR", "Rand sudafricano", "R"],
  ["TR", "Turquía", "TRY", "Lira turca", "₺"], ["RU", "Rusia", "RUB", "Rublo ruso", "₽"],
] as const;

function localFallback() {
  return LOCAL_COUNTRIES.map(([code, name, currencyCode, currencyName, symbol]) => ({
    code,
    name,
    currencies: [{ code: currencyCode, name: currencyName, symbol }],
  }));
}

export async function GET() {
  try {
    const response = await fetch(COUNTRIES_URL, {
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Country catalog unavailable");
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid country catalog");

    const countries = (payload as CountryRecord[]).flatMap((item) => {
      const code = typeof item.cca2 === "string" ? item.cca2.toUpperCase() : "";
      const name = typeof item.translations?.spa?.common === "string"
        ? item.translations.spa.common
        : typeof item.name?.common === "string" ? item.name.common : "";
      if (!/^[A-Z]{2}$/.test(code) || !name) return [];
      const currencies = Object.entries(item.currencies ?? {}).map(([currencyCode, value]) => ({
        code: currencyCode,
        name: typeof value?.name === "string" ? value.name : currencyCode,
        symbol: typeof value?.symbol === "string" ? value.symbol : "",
      })).filter((currency) => /^[A-Z]{3}$/.test(currency.code));
      return [{ code, name, currencies }];
    }).sort((a, b) => a.name.localeCompare(b.name, "es"));

    if (!countries.length) throw new Error("Empty country catalog");
    return NextResponse.json({ countries, fetchedAt: new Date().toISOString(), fallback: false });
  } catch {
    return NextResponse.json({
      countries: localFallback(),
      fetchedAt: new Date().toISOString(),
      fallback: true,
      warning: "Catálogo local reducido: no se pudo consultar el catálogo internacional.",
    });
  }
}
