"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./vera-savings-mode.module.css";
import { buildSavingsProjections, calculateSavingsProjection } from "@/lib/finance-algorithm/savings";

type ShoppingItem = { id: number; name: string; quantity: number; unitPrice: string };

const periods = [2, 3, 6, 12];

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export default function VeraSavingsMode() {
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monthlySaving, setMonthlySaving] = useState("50000");
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

  const monthlyValue = Number(monthlySaving);
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
            <span className={styles.freeTag}>Disponible en FREE</span>
          </div>
          <label className={styles.monthlyInput}>¿Cuánto estarías dispuesto/a a separar por mes?
            <div><span>$</span><input type="number" min="1" max="100000000" step="100" inputMode="decimal" value={monthlySaving} onChange={(event) => setMonthlySaving(event.target.value)} placeholder="Ej. 50000" /></div>
          </label>
          {validMonthlySaving ? (
            <div className={styles.projectionGrid}>
              {buildSavingsProjections(monthlyValue, periods).map(({ months: month, total: projectedTotal }) => (
                <article key={month} className={month === 12 ? styles.projectionHighlight : styles.projection}>
                  <span>{month} {month === 1 ? "mes" : "meses"}</span>
                  <strong>{money(projectedTotal)}</strong>
                  <small>{money(monthlyValue)} por mes</small>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.disclaimer}>Ingresá un importe mensual mayor a cero para calcular tus proyecciones.</p>
          )}
          <p className={styles.disclaimer}>Cálculo simple: aporte mensual × cantidad de meses. No contempla inflación, intereses, variaciones de ingresos ni retiros. No es una recomendación de cuánto deberías ahorrar.</p>
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
                  <div><span>En 6 meses</span><strong>{money(calculateSavingsProjection(monthlyValue, 6) ?? 0)}</strong></div>
                  <div><span>En 12 meses</span><strong>{money(calculateSavingsProjection(monthlyValue, 12) ?? 0)}</strong></div>
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
                      <div className={styles.itemName}><strong>{item.name}</strong><span>Cantidad: {item.quantity}{item.unitPrice ? ` · ${money(Number(item.unitPrice))} por unidad` : " · Sin precio de referencia"}</span></div>
                      <div className={styles.itemEnd}>
                        <strong>{item.unitPrice ? money(Number(item.unitPrice) * item.quantity) : "—"}</strong>
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
                  <div><span>Total estimado con precios cargados</span><strong>{money(total)}</strong></div>
                  {hasBudget && <div><span>{difference !== null && difference >= 0 ? "Presupuesto disponible" : "Exceso sobre el presupuesto"}</span><strong className={difference !== null && difference < 0 ? styles.over : styles.remaining}>{money(Math.abs(difference ?? 0))}</strong></div>}
                </div>
                {items.length > pricedItems && <p className={styles.disclaimer}>{items.length - pricedItems} producto(s) no tienen precio de referencia; el total no representa el costo completo de la compra.</p>}
                <p className={styles.disclaimer}>Los precios ingresados son referencias tuyas, no cotizaciones actuales ni ofertas verificadas. Moneda: ARS.</p>
              </article>
              <article className={styles.nextCard}>
                <span className={styles.eyebrow}>05 / HERRAMIENTAS EN DESARROLLO</span>
                <h2>Encontrá oportunidades</h2>
                <ul>
                  <li>Comparación de comercios y productos equivalentes</li>
                  <li>Descuentos con vigencia y condiciones verificadas</li>
                  <li>Alternativas económicas y precio por unidad</li>
                  <li>Optimización de canastas y compras familiares</li>
                  <li>Historial de ahorro potencial y ahorro confirmado</li>
                </ul>
                <div className={styles.sourceNote}>Estas herramientas se habilitarán cuando existan fuentes autorizadas, datos actualizados y persistencia segura. Esta vista no muestra ofertas en vivo.</div>
              </article>
            </section>
          </>
        )}
        <a href="/vera" className={styles.footerLink}>Volver a conversar con VERA</a>
      </main>
    </div>
  );
}
