import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 21600;

type FrankfurterRow = { date?: string; base?: string; quote?: string; rate?: number };
type AssetDefinition = {
  code: string;
  label: string;
  category: "Monedas" | "Metales preciosos" | "Criptoactivos";
  unit: string;
  description: string;
  explanation: string;
  invert: boolean;
};

const ASSETS: AssetDefinition[] = [
  { code: "ARS", label: "Peso argentino", category: "Monedas", unit: "ARS por USD", description: "Tipo de referencia entre el dólar estadounidense y el peso argentino.", explanation: "Es una referencia internacional basada en fuentes oficiales; no equivale necesariamente al dólar MEP, blue, tarjeta ni a una cotización de compraventa local.", invert: false },
  { code: "EUR", label: "Euro", category: "Monedas", unit: "EUR por USD", description: "Cuántos euros equivalen a un dólar estadounidense.", explanation: "Permite observar la relación de referencia entre dos monedas ampliamente utilizadas en el comercio internacional.", invert: false },
  { code: "GBP", label: "Libra esterlina", category: "Monedas", unit: "GBP por USD", description: "Cuántas libras esterlinas equivalen a un dólar estadounidense.", explanation: "Es una referencia para comparar la evolución de la libra frente al dólar; no representa una cotización de una casa de cambio.", invert: false },
  { code: "JPY", label: "Yen japonés", category: "Monedas", unit: "JPY por USD", description: "Cuántos yenes equivalen a un dólar estadounidense.", explanation: "Ayuda a seguir la relación de referencia entre el yen y el dólar, dos monedas relevantes en los mercados internacionales.", invert: false },
  { code: "BRL", label: "Real brasileño", category: "Monedas", unit: "BRL por USD", description: "Cuántos reales equivalen a un dólar estadounidense.", explanation: "Ofrece contexto sobre la moneda de Brasil, una economía importante para la región y el comercio argentino.", invert: false },
  { code: "CLP", label: "Peso chileno", category: "Monedas", unit: "CLP por USD", description: "Cuántos pesos chilenos equivalen a un dólar estadounidense.", explanation: "Permite comparar la evolución de una moneda sudamericana frente al dólar usando referencias oficiales.", invert: false },
  { code: "UYU", label: "Peso uruguayo", category: "Monedas", unit: "UYU por USD", description: "Cuántos pesos uruguayos equivalen a un dólar estadounidense.", explanation: "Aporta contexto regional sobre la relación entre el peso uruguayo y el dólar.", invert: false },
  { code: "PYG", label: "Guaraní paraguayo", category: "Monedas", unit: "PYG por USD", description: "Cuántos guaraníes equivalen a un dólar estadounidense.", explanation: "Aporta contexto regional sobre la moneda paraguaya frente al dólar.", invert: false },
  { code: "CNY", label: "Yuan chino", category: "Monedas", unit: "CNY por USD", description: "Cuántos yuanes equivalen a un dólar estadounidense.", explanation: "Es una referencia útil para seguir la relación entre el dólar y la moneda de una de las mayores economías del mundo.", invert: false },
  { code: "CAD", label: "Dólar canadiense", category: "Monedas", unit: "CAD por USD", description: "Cuántos dólares canadienses equivalen a un dólar estadounidense.", explanation: "Permite observar la relación de referencia entre dos monedas importantes para el comercio internacional.", invert: false },
  { code: "AUD", label: "Dólar australiano", category: "Monedas", unit: "AUD por USD", description: "Cuántos dólares australianos equivalen a un dólar estadounidense.", explanation: "Aporta contexto sobre la evolución de la moneda australiana frente al dólar estadounidense.", invert: false },
  { code: "MXN", label: "Peso mexicano", category: "Monedas", unit: "MXN por USD", description: "Cuántos pesos mexicanos equivalen a un dólar estadounidense.", explanation: "Permite comparar la evolución de una moneda latinoamericana de gran volumen frente al dólar.", invert: false },
  { code: "INR", label: "Rupia india", category: "Monedas", unit: "INR por USD", description: "Cuántas rupias equivalen a un dólar estadounidense.", explanation: "Aporta contexto sobre la relación entre el dólar y la moneda de India.", invert: false },
  { code: "ZAR", label: "Rand sudafricano", category: "Monedas", unit: "ZAR por USD", description: "Cuántos rands equivalen a un dólar estadounidense.", explanation: "Permite seguir una moneda relevante de África frente al dólar.", invert: false },
  { code: "XAU", label: "Oro", category: "Metales preciosos", unit: "USD por onza troy", description: "Valor de referencia en dólares por una onza troy de oro.", explanation: "El oro es un metal precioso utilizado como referencia histórica de reserva de valor. La serie depende de las fuentes oficiales disponibles y no es una cotización intradiaria.", invert: true },
  { code: "XAG", label: "Plata", category: "Metales preciosos", unit: "USD por onza troy", description: "Valor de referencia en dólares por una onza troy de plata.", explanation: "La plata tiene usos industriales y financieros. Su precio de referencia puede variar según las fuentes y fechas publicadas.", invert: true },
  { code: "XPT", label: "Platino", category: "Metales preciosos", unit: "USD por onza troy", description: "Valor de referencia en dólares por una onza troy de platino.", explanation: "El platino tiene usos industriales, especialmente en ciertos procesos y componentes. La disponibilidad de observaciones puede ser menor que la del oro.", invert: true },
  { code: "XPD", label: "Paladio", category: "Metales preciosos", unit: "USD por onza troy", description: "Valor de referencia en dólares por una onza troy de paladio.", explanation: "El paladio es un metal con demanda industrial. La cobertura histórica y la frecuencia pueden ser más limitadas.", invert: true },
  { code: "BTC", label: "Bitcoin", category: "Criptoactivos", unit: "USD por BTC", description: "Valor de referencia de un bitcoin expresado en dólares.", explanation: "Es un activo digital de alta volatilidad. Esta referencia puede tener cobertura limitada y no debe interpretarse como precio ejecutable ni como recomendación.", invert: true },
  { code: "ETH", label: "Ether", category: "Criptoactivos", unit: "USD por ETH", description: "Valor de referencia de un ether expresado en dólares.", explanation: "Es el activo nativo de Ethereum. La serie de referencia puede depender de pocas fuentes y no necesariamente refleja todos los mercados.", invert: true },
  { code: "SOL", label: "Solana", category: "Criptoactivos", unit: "USD por SOL", description: "Valor de referencia de un SOL expresado en dólares.", explanation: "Es un criptoactivo cuya cobertura en esta fuente es limitada. Los datos son informativos y no una señal de compra o venta.", invert: true },
  { code: "XRP", label: "XRP", category: "Criptoactivos", unit: "USD por XRP", description: "Valor de referencia de un XRP expresado en dólares.", explanation: "Es un criptoactivo con cobertura de referencia limitada. La frecuencia depende de las publicaciones de las fuentes que lo cubren.", invert: true },
  { code: "USDT", label: "Tether", category: "Criptoactivos", unit: "USD por USDT", description: "Valor de referencia de USDT expresado en dólares.", explanation: "Es una stablecoin que busca mantener paridad con el dólar, pero esa paridad no está garantizada y puede variar.", invert: true },
  { code: "USDC", label: "USD Coin", category: "Criptoactivos", unit: "USD por USDC", description: "Valor de referencia de USDC expresado en dólares.", explanation: "Es una stablecoin diseñada para seguir al dólar, aunque puede presentar diferencias y riesgos propios.", invert: true },
];

export async function GET() {
  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);
  const quotes = ASSETS.map((asset) => asset.code.toLowerCase()).join(",");
  const url = new URL("https://api.frankfurter.dev/v2/rates");
  url.searchParams.set("base", "USD");
  url.searchParams.set("quotes", quotes);
  url.searchParams.set("from", from);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate },
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "El proveedor de referencias internacionales no respondió correctamente." }, { status: 502 });
    }
    const rows = await response.json() as FrankfurterRow[];
    if (!Array.isArray(rows)) throw new Error("Respuesta inválida del proveedor.");

    const assets = ASSETS.map((asset) => {
      const history = rows
        .filter((row) => row.quote?.toUpperCase() === asset.code && typeof row.date === "string" && typeof row.rate === "number" && Number.isFinite(row.rate) && row.rate > 0)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((row) => ({ date: row.date as string, value: asset.invert ? 1 / (row.rate as number) : row.rate as number }))
        .slice(-12);
      const latest = history[history.length - 1];
      return {
        ...asset,
        value: latest?.value ?? null,
        date: latest?.date ?? null,
        history,
      };
    });

    const groups = ["Monedas", "Metales preciosos", "Criptoactivos"].map((category) => ({
      category,
      assets: assets.filter((asset) => asset.category === category),
    })).filter((group) => group.assets.length > 0);

    return NextResponse.json({
      provider: "Frankfurter · tipos de referencia de bancos centrales y otras fuentes oficiales",
      providerUrl: "https://frankfurter.dev/es/",
      fetchedAt: new Date().toISOString(),
      base: "USD",
      groups,
      notice: "Son tipos de referencia publicados por las fuentes, no precios en tiempo real ni cotizaciones de compraventa. La cobertura y la última fecha disponible varían por activo; los criptoactivos tienen menos fuentes.",
    }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "No pudimos consultar las referencias internacionales. Los indicadores económicos siguen disponibles; intentá actualizar más tarde." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
