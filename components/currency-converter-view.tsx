"use client";

import { useMemo, useState } from "react";

const currencies = [
  { code: "ARS", label: "Peso argentino" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" }
];

const comparisonSources = [
  { id: "oficial", name: "Dólar oficial", description: "Referencia del mercado oficial" },
  { id: "mep", name: "Dólar MEP", description: "Dólar financiero" },
  { id: "blue", name: "Dólar blue", description: "Cotización del mercado informal" },
  { id: "euro", name: "Euro", description: "Referencia para la moneda europea" }
];

export default function CurrencyConverterView() {
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("ARS");
  const [to, setTo] = useState("USD");
  const [selectedSources, setSelectedSources] = useState<string[]>(["oficial", "mep", "blue"]);

  const parsedAmount = useMemo(() => {
    const normalized = amount.trim().replace(/\\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [amount]);

  function swapCurrencies() {
    setFrom(to);
    setTo(from);
  }

  function toggleSource(id: string) {
    setSelectedSources((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

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
              <span className="converter-live-label"><i /> Cotizaciones verificadas</span>
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

            <div className="converter-result-placeholder">
              <span>Resultado de la conversión</span>
              <strong>{parsedAmount === null ? "Ingresá un importe válido" : "Cotizaciones en conexión"}</strong>
              <p>No mostramos resultados hasta disponer de una cotización actualizada y una fuente verificable.</p>
            </div>
            <div className="converter-source-note"><span aria-hidden="true">ⓘ</span> La cotización, su fuente y la hora de actualización aparecerán junto al resultado.</div>
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
            <div className="converter-result-placeholder advanced">
              <span>Comparación de resultados</span>
              <strong>{parsedAmount === null ? "Ingresá un importe válido" : "Fuentes de cotización en conexión"}</strong>
              <p>Mostraremos el valor equivalente para cada fuente, la diferencia porcentual y la hora de actualización.</p>
            </div>
          </section>
        )}

        <p className="converter-disclaimer">Las conversiones serán informativas y no modificarán los saldos de tus cuentas ni registrarán movimientos.</p>
      </main>
    </div>
  );
}
