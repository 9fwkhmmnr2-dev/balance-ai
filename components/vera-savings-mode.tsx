"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./vera-savings-mode.module.css";
import { calculateSavingsProjection } from "@/lib/finance-algorithm/savings";

type SavingsCurrency = "ARS" | "USD" | "EUR" | "BRL";
type ExchangeRates = { date: string; source: string; rates: Partial<Record<SavingsCurrency, number>> };

type ShoppingItem = { id: number; name: string; quantity: number; unitPrice: string };

const periods = [2, 3, 6, 12];

function money(value: number, currency: SavingsCurrency) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: currency === "ARS" ? 0 : 2 }).format(value);
}

export default function VeraSavingsMode() {
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monthlySaving, setMonthlySaving] = useState("50000");
  const [savingCurrency, setSavingCurrency] = useState<SavingsCurrency>("ARS");
  const [displayMode, setDisplayMode] = useState<"both" | "original" | "converted">("both");
  const [convertedCurrency, setConvertedCurrency] = useState<SavingsCurrency>("USD");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [budget, setBudget] = useState("");
  const [items, setItems] = useState<ShoppingItem[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/vera/entitlement", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = await response.json() as { isPlus?: boolean };
        if (active) setIsPlus(Boolean(result.isPlus));
      } catch {
        // The basic calculator remains available if entitlement lookup fails.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/vera/ahorro/cotizaciones", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Cotizaciones no disponibles"); return await response.json() as ExchangeRates; })
      .then((data) => { if (active) { setExchangeRates(data); setRatesError(""); } })
      .catch(() => { if (active) setRatesError("No hay cotizaciones disponibles ahora. Podés seguir usando la proyección en tu moneda original."); })
      .finally(() => { if (active) setRatesLoading(false); });
    return () => { active = false; };
  }, []);

  const monthlyValue = Number(monthlySaving);
  const originalRate = savingCurrency === "ARS" ? 1 : exchangeRates?.rates[savingCurrency];
  const targetRate = convertedCurrency === "ARS" ? 1 : exchangeRates?.rates[convertedCurrency];
  const canConvert = savingCurrency !== convertedCurrency && Number.isFinite(originalRate) && Number.isFinite(targetRate) && Number(originalRate) > 0 && Number(targetRate) > 0;
  const projectedIn = (months: number) => {
    const original = monthlyValue * months;
    return { original, converted: canConvert ? original * Number(originalRate) / Number(targetRate) : null };
  };
  const validMonthlySaving = monthlySaving.trim() !== "" && Number.isFinite(monthlyValue) && monthlyValue > 0;
  const total = useMemo(() => items.reduce((sum, item) => {
    const price = Number(item.unitPrice);
    return sum + (Number.isFinite(price) && price >= 0 ? price * item.quantity : 0);
  }, 0), [items]);
  const pricedItems = items.filter((item) => item.unitPrice.trim() !== "").length;
  const budgetValue = Number(budget);
  const hasBudget = budget.trim() !== "" && Number.isFinite(budgetValue) && budgetValue >= 0;
  const difference = hasBudget ? budgetValue - total : null;

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const count = Number(quantity);
    if (!cleanName || !Number.isInteger(count) || count < 1 || count > 999) return;
    if (unitPrice.trim() !== "" && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) return;
    setItems((current) => [...current, { id: Date.now() + current.length, name: cleanName, quantity: count, unitPrice: unitPrice.trim() }]);
    setName("");
    setQuantity("1");
    setUnitPrice("");
  }

  if (loading) {
    return <div className={styles.page}><main className={styles.main}><p className={styles.loading}>Comprobando FINANCE PLUS…</p></main></div>;
  }

  if (!isPlus) {
    return (
      <div className={styles.page}>
        <header className={styles.topbar}>
          <a href="/finance-plus" className={styles.back}>← FINANCE.TRACK</a>
          <span className={styles.topTag}>FINANCE PLUS</span>
        </header>
        <main className={styles.main}>
          <section className={styles.locked}>
            <span className={styles.lockIcon}>✦</span>
            <p className={styles.eyebrow}>HERRAMIENTA EXCLUSIVA</p>
            <h1>Modo Ahorro y canasta inteligente</h1>
            <p>El Modo Ahorro, la planificación de compras y el análisis de canastas básicas y familiares están incluidos en FINANCE PLUS.</p>
            <a href="/finance-plus" className={styles.primaryLink}>Conocer FINANCE PLUS</a>
          </section>
          <a href="/vera" className={styles.footerLink}>Volver a conversar con VERA</a>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a href="/finance-plus" className={styles.back}>← FINANCE.TRACK</a>
        <span className={styles.topTag}>MODO AHORRO</span>
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>FINANCE.TRACK · MODO AHORRO</p>
          <h1>Convertí una intención en <span>un plan posible.</span></h1>
          <p>Calculá cuánto podrías acumular y elegí un ritmo de ahorro que tenga sentido para tu situación. Las proyecciones no incluyen intereses ni garantizan resultados.</p>
        </section>

        <section className={styles.calculator}>
          <div className={styles.sectionTitle}>
            <div><span className={styles.eyebrow}>01 / CALCULADORA</span><h2>¿Cuánto podrías ahorrar?</h2></div>
            <span className={styles.plusTag}>FINANCE PLUS</span>
          </div>
          <div className={styles.currencyControls}>
            <label className={styles.monthlyInput}>¿Cuánto estarías dispuesto/a a separar por mes?
              <div><span>{savingCurrency}</span><input type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" value={monthlySaving} onChange={(event) => setMonthlySaving(event.target.value)} placeholder="Ej. 50" /></div>
            </label>
            <label className={styles.currencySelect}>Moneda del objetivo
              <select value={savingCurrency} onChange={(event) => setSavingCurrency(event.target.value as SavingsCurrency)}><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option><option value="BRL">BRL · Real brasileño</option></select>
            </label>
          </div>
          <div className={styles.displayControls}>
            <label className={styles.currencySelect}>Visualización
              <select value={displayMode} onChange={(event) => setDisplayMode(event.target.value as typeof displayMode)}><option value="both">Mostrar ambas monedas</option><option value="original">Solo moneda del objetivo</option><option value="converted">Solo moneda convertida</option></select>
            </label>
            <label className={styles.currencySelect}>Ver equivalencia en
              <select value={convertedCurrency} onChange={(event) => setConvertedCurrency(event.target.value as SavingsCurrency)}><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option><option value="BRL">BRL · Real brasileño</option></select>
            </label>
          </div>
          {validMonthlySaving ? <div className={styles.projectionGrid}>
            {periods.map((month) => { const projection = projectedIn(month); return <article key={month} className={month === 12 ? styles.projectionHighlight : styles.projection}>
              <span>{month} meses</span>
              {displayMode !== "converted" && <strong>{money(projection.original, savingCurrency)}</strong>}
              {displayMode !== "original" && (canConvert && projection.converted !== null ? <strong className={styles.convertedAmount}>{money(projection.converted, convertedCurrency)}</strong> : <small>Equivalencia no disponible</small>)}
              <small>{money(monthlyValue, savingCurrency)} por mes</small>
            </article>; })}
          </div> : <p className={styles.disclaimer}>Ingresá un importe mensual mayor a cero para calcular tus proyecciones.</p>}
          <div className={styles.exchangeInfo}>{ratesLoading ? "Consultando cotizaciones de referencia…" : exchangeRates && canConvert ? `Referencia BCRA · ${exchangeRates.date} · Cotización oficial publicada; no representa necesariamente el precio minorista de compra o venta.` : ratesError || "Elegí dos monedas distintas para ver su equivalencia."}</div>
          <p className={styles.disclaimer}>Importante: estas proyecciones son estimaciones matemáticas basadas en el aporte indicado y, para la conversión, en la cotización disponible al momento del cálculo. No contemplan inflación, devaluación, cambios futuros del tipo de cambio, variaciones de precios, impuestos, comisiones, intereses, retiros ni otros acontecimientos económicos. El valor real y el poder adquisitivo del ahorro pueden ser diferentes. No es una recomendación financiera ni una predicción.</p>
        </section>

        {loading ? (
          <p className={styles.loading}>Comprobando las herramientas disponibles…</p>
        ) : !isPlus ? (
          <section className={styles.locked}>
            <span className={styles.lockIcon}>✦</span>
            <p className={styles.eyebrow}>FINANCE PLUS</p>
            <h2>Ya sabés cuánto podrías acumular. Ahora descubrí cómo acercarte.</h2>
            <p>FINANCE PLUS amplía la calculadora con Operación de Ahorro personalizada, seguimiento inteligente y herramientas para encontrar oportunidades en tus compras.</p>
            <a href="/finance-plus" className={styles.primaryLink}>Conocer FINANCE PLUS</a>
          </section>
        ) : (
          <>
            <section className={styles.operationCard}>
              <span className={styles.eyebrow}>02 / FINANCE PLUS · OPERACIÓN DE AHORRO</span>
              <h2>Tu operación personalizada</h2>
              <p>Usamos el importe que elegiste para mostrar un punto de partida. Antes de recomendar un ritmo, FINANCE: ALGORITMO deberá contrastarlo con tus ingresos, gastos esenciales, compromisos y reservas disponibles.</p>
              {validMonthlySaving ? (
                <div className={styles.operationResult}>
                  <div><span>En 6 meses</span><strong>{money(calculateSavingsProjection(monthlyValue, 6) ?? 0, savingCurrency)}</strong></div>
                  <div><span>En 12 meses</span><strong>{money(calculateSavingsProjection(monthlyValue, 12) ?? 0, savingCurrency)}</strong></div>
                </div>
              ) : <p className={styles.disclaimer}>Ingresá un importe válido para ver el escenario.</p>}
              <p className={styles.disclaimer}>Esta primera vista es una simulación aritmética. Todavía no verifica capacidad de ahorro ni crea una reserva de dinero.</p>
            </section>

            <section className={styles.workspace}>
              <div className={styles.sectionTitle}>
                <div><span className={styles.eyebrow}>03 / PLANIFICACIÓN</span><h2>Tu lista de compras</h2></div>
                <span className={styles.count}>{items.length} {items.length === 1 ? "producto" : "productos"}</span>
              </div>
              <form className={styles.addForm} onSubmit={addItem}>
                <label className={styles.fieldWide}>Producto
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Leche entera 1 litro" maxLength={100} required />
                </label>
                <label>Cantidad
                  <input type="number" min="1" max="999" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
                </label>
                <label>Precio unitario de referencia
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Opcional" />
                </label>
                <button type="submit" className={styles.addButton}>+ Agregar a la lista</button>
              </form>
              {items.length === 0 ? (
                <div className={styles.empty}><strong>Tu lista está vacía</strong><span>Agregá los productos que necesitás para organizar tu próxima compra.</span></div>
              ) : (
                <ul className={styles.items}>
                  {items.map((item) => (
                    <li key={item.id}>
                      <div className={styles.itemName}><strong>{item.name}</strong><span>Cantidad: {item.quantity}{item.unitPrice ? ` · ${money(Number(item.unitPrice), "ARS")} por unidad` : " · Sin precio de referencia"}</span></div>
                      <div className={styles.itemEnd}>
                        <strong>{item.unitPrice ? money(Number(item.unitPrice) * item.quantity, "ARS") : "—"}</strong>
                        <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Quitar ${item.name}`}>Quitar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.summaryGrid}>
              <article className={styles.budgetCard}>
                <span className={styles.eyebrow}>04 / CONTROL</span>
                <h2>Tu presupuesto</h2>
                <label className={styles.budgetInput}>¿Cuánto querés destinar a esta compra?
                  <div><span>$</span><input type="number" min="0" step="0.01" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ej. 50000" /></div>
                </label>
                <div className={styles.budgetStats}>
                  <div><span>Total estimado con precios cargados</span><strong>{money(total, "ARS")}</strong></div>
                  {hasBudget && <div><span>{difference !== null && difference >= 0 ? "Presupuesto disponible" : "Exceso sobre el presupuesto"}</span><strong className={difference !== null && difference < 0 ? styles.over : styles.remaining}>{money(Math.abs(difference ?? 0), "ARS")}</strong></div>}
                </div>
                {items.length > pricedItems && <p className={styles.disclaimer}>{items.length - pricedItems} producto(s) no tienen precio de referencia; el total no representa el costo completo de la compra.</p>}
                <p className={styles.disclaimer}>Los precios ingresados son referencias tuyas, no cotizaciones actuales ni ofertas verificadas. Moneda: ARS.</p>
              </article>
              <article className={styles.nextCard}>
                <span className={styles.eyebrow}>05 / VERA:AHORRO · PRÓXIMA INTEGRACIÓN</span>
                <h2>Comparador inteligente</h2>
                <ul>
                  <li>Precios de supermercados informados en SEPA, con fecha y comercio de origen</li>
                  <li>Publicaciones de marketplaces, identificadas como tales</li>
                  <li>Productos equivalentes, presentación y precio por unidad</li>
                  <li>Comparación por localidad o código postal ingresado manualmente</li>
                  <li>Promociones y condiciones, solo cuando la fuente permita verificarlas</li>
                </ul>
                <div className={styles.sourceNote}>La beta todavía no muestra cotizaciones en vivo. Cada resultado deberá incluir su fuente, fecha de actualización y nivel de confianza. Un precio informado por un comercio no equivale a una verificación independiente en góndola.</div>
              </article>
            </section>
          </>
        )}
        <a href="/vera" className={styles.footerLink}>Volver a conversar con VERA</a>
      </main>
    </div>
  );
}
