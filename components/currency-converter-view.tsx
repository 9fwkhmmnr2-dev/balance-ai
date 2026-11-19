"use client";

import { useEffect, useMemo, useState } from "react";

const currencies = [
  { code: "ARS", label: "Peso argentino" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" },
];

const comparisonSources = [
  { id: "oficial", name: "Dólar oficial", description: "Referencia oficial" },
  { id: "mep", name: "Dólar MEP", description: "Dólar bolsa" },
  { id: "blue", name: "Dólar blue", description: "Referencia del mercado informal" },
  { id: "euro", name: "Euro oficial", description: "Euro Banco Nación" },
] as const;

type QuoteId = (typeof comparisonSources)[number]["id"];
type Quote = {
  id: QuoteId;
  name: string;
  currency: "USD" | "EUR";
  buy: number;
  sell: number;
  updatedAt: string | null;
  lastScrapedAt: string;
  stale: boolean;
  marketClosed: boolean;
};
type QuoteResponse = {
  provider: string;
  providerUrl: string;
  checkedAt: string;
  quotes: Quote[];
  error?: string;
};

function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(/[.]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CurrencyConverterView() {
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("ARS");
  const [to, setTo] = useState("USD");
  const [usdSource, setUsdSource] = useState<"oficial" | "mep" | "blue">("oficial");
  const [selectedSources, setSelectedSources] = useState<string[]>(["oficial", "mep", "blue"]);
  const [quoteData, setQuoteData] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadQuotes() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/currency-quotes", { cache: "no-store" });
        const data = (await response.json()) as QuoteResponse;
        if (!response.ok) throw new Error(data.error || "No pudimos cargar las cotizaciones.");
        if (!Array.isArray(data.quotes)) throw new Error("La respuesta de cotizaciones no es válida.");
        if (active) setQuoteData(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No pudimos cargar las cotizaciones.");
          setQuoteData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQuotes();
    return () => { active = false; };
  }, [refreshKey]);

  const parsedAmount = useMemo(() => parseAmount(amount), [amount]);
  const getQuote = (id: string) => quoteData?.quotes.find((quote) => quote.id === id);
  const usdQuote = getQuote(usdSource);
  const euroQuote = getQuote("euro");

  const conversion = useMemo(() => {
    if (parsedAmount === null || from === to) {
      return parsedAmount !== null && from === to
        ? { value: parsedAmount, stale: false, missing: false, marketClosed: false }
        : null;
    }

    const usd = quoteData?.quotes.find((quote) => quote.id === usdSource);
    const euro = quoteData?.quotes.find((quote) => quote.id === "euro");
    const required: Quote[] = [];
    let pesos: number;

    if (from === "ARS") {
      pesos = parsedAmount;
    } else if (from === "USD" && usd) {
      required.push(usd);
      pesos = parsedAmount * usd.buy;
    } else if (from === "EUR" && euro) {
      required.push(euro);
      pesos = parsedAmount * euro.buy;
    } else {
      return { value: null, stale: false, missing: true };
    }

    let result: number;
    if (to === "ARS") {
      result = pesos;
    } else if (to === "USD" && usd) {
      required.push(usd);
      result = pesos / usd.sell;
    } else if (to === "EUR" && euro) {
      required.push(euro);
      result = pesos / euro.sell;
    } else {
      return { value: null, stale: false, missing: true };
    }

    return {
      value: result,
      stale: required.some((quote) => quote.stale),
      missing: false,
      marketClosed: required.some((quote) => quote.marketClosed),
    };
  }, [parsedAmount, from, to, quoteData, usdSource]);

  function swapCurrencies() {
    setFrom(to);
    setTo(from);
  }

  function toggleSource(id: string) {
    setSelectedSources((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const advancedRows = selectedSources
    .map((id) => {
      const quote = getQuote(id);
      if (!quote) return { id, quote: null, value: null, difference: null };
      const value = parsedAmount === null ? null : parsedAmount / quote.sell;
      const official = getQuote("oficial");
      const difference =
        quote.currency === "USD" && official && official.sell > 0
          ? ((quote.sell / official.sell) - 1) * 100
          : null;
      return { id, quote, value, difference };
    });

  return (
    <div className="converter-page">
      <header className="converter-desktop-nav">
        <a href="/" className="mobile-brand">FINANCE<span>.</span>AI</a>
        <nav aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/movimientos">Movimientos</a>
          <a href="/cuentas">Mis cuentas</a>
          <a href="/conversor" aria-current="page">Conversor</a>
          <a href="/perfil">Perfil</a>
        </nav>
      </header>

      <main className="converter-main">
        <header className="converter-heading">
          <div>
            <p className="eyebrow">HERRAMIENTAS FINANCIERAS</p>
            <h1>Conversor de monedas</h1>
            <p>Consultá equivalencias y compará distintas cotizaciones.</p>
          </div>
        </header>

        <div className="converter-mode-switch" role="tablist" aria-label="Modalidad de conversión">
          <button type="button" role="tab" aria-selected={mode === "quick"} className={mode === "quick" ? "selected" : ""} onClick={() => setMode("quick")}>
            <span aria-hidden="true">⇄</span>
            <span><strong>Conversión rápida</strong><small>Una equivalencia directa</small></span>
          </button>
          <button type="button" role="tab" aria-selected={mode === "advanced"} className={mode === "advanced" ? "selected" : ""} onClick={() => setMode("advanced")}>
            <span aria-hidden="true">▥</span>
            <span><strong>Modo avanzado</strong><small>Compará cotizaciones</small></span>
          </button>
        </div>

        {mode === "quick" ? (
          <section className="converter-card" aria-label="Conversión rápida">
            <div className="converter-card-heading">
              <div><p className="eyebrow">CONVERSIÓN DIRECTA</p><h2>¿Cuánto querés convertir?</h2></div>
              <span className={"converter-live-label " + (loading ? "pending" : error ? "failed" : "connected")}><i /> {loading ? "Actualizando" : error ? "Sin conexión" : "Fuente conectada"}</span>
            </div>

            <label className="converter-amount-field">
              <span>Importe</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ingresá un importe" />
            </label>

            <div className="converter-currency-row">
              <label><span>De</span><select value={from} onChange={(event) => setFrom(event.target.value)}>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.label}</option>)}</select></label>
              <button className="converter-swap" type="button" onClick={swapCurrencies} aria-label="Intercambiar monedas">⇄</button>
              <label><span>A</span><select value={to} onChange={(event) => setTo(event.target.value)}>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.label}</option>)}</select></label>
            </div>

            <label className="converter-quick-source">
              <span>Referencia para el dólar</span>
              <select value={usdSource} onChange={(event) => setUsdSource(event.target.value as typeof usdSource)}>
                <option value="oficial">Dólar oficial</option>
                <option value="mep">Dólar MEP</option>
                <option value="blue">Dólar blue</option>
              </select>
              <small>Para conversiones con euros se utiliza la referencia Euro oficial.</small>
            </label>

            <div className="converter-result-placeholder">
              <span>Resultado de la conversión</span>
              {loading ? <strong>Consultando cotizaciones…</strong> :
                error ? <strong>No se pudo cargar la cotización</strong> :
                parsedAmount === null ? <strong>Ingresá un importe válido</strong> :
                conversion?.missing ? <strong>Cotización no disponible</strong> :
                conversion?.stale ? <strong>Dato desactualizado · no disponible para calcular</strong> :
                conversion?.value !== null && conversion?.value !== undefined ? <strong>{formatMoney(conversion.value, to)}</strong> :
                <strong>Esperando datos</strong>}
              <p>
                {error || (conversion?.stale
                  ? "La fuente no confirmó este valor recientemente. No usamos esta cotización para calcular."
                  : conversion?.marketClosed
                    ? "Mercado cerrado. Se muestra la última cotización confirmada; el valor puede cambiar cuando vuelva a operar."
                    : "El cálculo utiliza el valor de compra o venta correspondiente al sentido de la conversión.")}
              </p>
            </div>
            {error && <button type="button" className="converter-refresh-button" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar conexión</button>}
            {!loading && !error && usdQuote && euroQuote && (
              <div className="converter-source-note">
                <span aria-hidden="true">ⓘ</span>
                <span>Fuente: MonedAPI · USD {usdQuote.name}: compra {formatMoney(usdQuote.buy, "ARS")} / venta {formatMoney(usdQuote.sell, "ARS")}. Valor desde {usdQuote.updatedAt ? formatDate(usdQuote.updatedAt) : "fecha no informada"}; confirmado {formatDate(usdQuote.lastScrapedAt)}. Euro oficial: compra {formatMoney(euroQuote.buy, "ARS")} / venta {formatMoney(euroQuote.sell, "ARS")}. Valor desde {euroQuote.updatedAt ? formatDate(euroQuote.updatedAt) : "fecha no informada"}; confirmado {formatDate(euroQuote.lastScrapedAt)}{euroQuote.marketClosed ? " · mercado cerrado" : ""}.</span>
              </div>
            )}
          </section>
        ) : (
          <section className="converter-card" aria-label="Comparación avanzada de cotizaciones">
            <div className="converter-card-heading">
              <div><p className="eyebrow">ANÁLISIS DE MERCADO</p><h2>Compará cotizaciones</h2></div>
              <span className="converter-advanced-tag">Modo avanzado</span>
            </div>
            <label className="converter-amount-field">
              <span>Importe de referencia en pesos</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ingresá un importe" />
            </label>
            <div className="converter-comparison-heading"><div><strong>Fuentes a comparar</strong><p>Elegí qué referencias querés incluir.</p></div><span>{selectedSources.length} seleccionadas</span></div>
            <div className="converter-source-list">
              {comparisonSources.map((source) => (
                <label className={"converter-source-option " + (selectedSources.includes(source.id) ? "active" : "")} key={source.id}>
                  <input type="checkbox" checked={selectedSources.includes(source.id)} onChange={() => toggleSource(source.id)} />
                  <span><strong>{source.name}</strong><small>{source.description}</small></span>
                  <i aria-hidden="true">{selectedSources.includes(source.id) ? "✓" : "+"}</i>
                </label>
              ))}
            </div>
            <div className="converter-advanced-results">
              <div className="converter-comparison-heading"><div><strong>Equivalencia estimada</strong><p>Cuántas unidades de cada moneda representa el importe en pesos, usando el valor de venta.</p></div></div>
              {loading ? <p className="converter-status">Consultando cotizaciones…</p> :
                error ? <p className="converter-status">{error}</p> :
                parsedAmount === null ? <p className="converter-status">Ingresá un importe válido para comparar.</p> :
                advancedRows.length === 0 ? <p className="converter-status">Seleccioná al menos una fuente.</p> :
                <div className="converter-quote-results">
                  {advancedRows.map((row) => (
                    <article className="converter-quote-result" key={row.id}>
                      <div><strong>{row.quote?.name ?? comparisonSources.find((source) => source.id === row.id)?.name}</strong>
                        {row.quote && <><small>Compra {formatMoney(row.quote.buy, "ARS")} · Venta {formatMoney(row.quote.sell, "ARS")}</small><small className={row.quote.stale ? "converter-stale-meta" : row.quote.marketClosed ? "converter-market-meta" : ""}>{row.quote.stale ? "Dato desactualizado" : row.quote.marketClosed ? "Mercado cerrado · último valor confirmado" : "Fuente confirmada"} · valor desde {row.quote.updatedAt ? formatDate(row.quote.updatedAt) : "fecha no informada"} · confirmado {formatDate(row.quote.lastScrapedAt)}</small></>}
                      </div>
                      {row.quote?.stale ? <strong className="converter-stale-value">Dato desactualizado</strong> :
                        row.value !== null && row.value !== undefined ? <strong>{formatMoney(row.value, row.quote?.currency ?? "USD")}</strong> :
                        <strong>No disponible</strong>}
                      {row.difference !== null && row.difference !== undefined && !row.quote?.stale && (
                        <small className="converter-difference">{row.difference > 0 ? "+" : ""}{row.difference.toFixed(2).replace(".", ",")}% vs. oficial</small>
                      )}
                    </article>
                  ))}
                </div>}
            </div>
            {error && <button type="button" className="converter-refresh-button" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar conexión</button>}
            {!loading && !error && quoteData && (
              <div className="converter-source-note"><span aria-hidden="true">ⓘ</span> Fuente: {quoteData.provider}. Última consulta del servidor: {formatDate(quoteData.checkedAt)}. Los datos desactualizados se excluyen de los cálculos.</div>
            )}
          </section>
        )}

        <p className="converter-disclaimer">Las conversiones son informativas y no modifican los saldos de tus cuentas ni registran movimientos. Las cotizaciones pueden variar según la fuente y el momento de consulta.</p>
      </main>
    </div>
  );
}
