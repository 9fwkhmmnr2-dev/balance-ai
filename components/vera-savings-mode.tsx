"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./vera-savings-mode.module.css";

type ShoppingItem = { id: number; name: string; quantity: number; unitPrice: string };

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
}

export default function VeraSavingsMode() {
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
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
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

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

  if (loading) return <div className={styles.page}><p className={styles.loading}>Cargando FINANCE PLUS…</p></div>;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a href="/finance-plus" className={styles.back}>← FINANCE PLUS</a>
        <span className={styles.topTag}>VERA / MODO AHORRO</span>
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>FINANCE PLUS · NUEVO MÓDULO</p>
          <h1>Comprá con más información. <span>Gastá con intención.</span></h1>
          <p>Organizá lo que necesitás, definí un presupuesto y prepará tus compras. VERA te ayudará a comparar opciones verificadas cuando las fuentes estén disponibles.</p>
        </section>

        {!isPlus ? (
          <section className={styles.locked}>
            <span className={styles.lockIcon}>✦</span>
            <h2>Una herramienta de FINANCE PLUS</h2>
            <p>La lista y el presupuesto inteligente forman parte de la experiencia Plus. El comparador de comercios, promociones y optimización de compras se habilitarán cuando estén integradas fuentes de datos confiables.</p>
            <a href="/finance-plus" className={styles.primaryLink}>Conocer FINANCE PLUS</a>
          </section>
        ) : (
          <>
            <section className={styles.workspace}>
              <div className={styles.sectionTitle}>
                <div><span className={styles.eyebrow}>01 / PLANIFICACIÓN</span><h2>Tu lista de compras</h2></div>
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
                <span className={styles.eyebrow}>02 / CONTROL</span>
                <h2>Tu presupuesto</h2>
                <label className={styles.budgetInput}>¿Cuánto querés destinar a esta compra?
                  <div><span>$</span><input type="number" min="0" step="0.01" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Ej. 50000" /></div>
                </label>
                <div className={styles.budgetStats}>
                  <div><span>Total estimado con precios cargados</span><strong>{money(total)}</strong></div>
                  {hasBudget && <div><span>{difference !== null && difference >= 0 ? "Presupuesto disponible" : "Exceso sobre el presupuesto"}</span><strong className={difference !== null && difference < 0 ? styles.over : styles.remaining}>{money(Math.abs(difference ?? 0))}</strong></div>}
                </div>
                {items.length > pricedItems && <p className={styles.disclaimer}>{items.length - pricedItems} producto(s) no tienen precio de referencia; el total no representa el costo completo de la compra.</p>}
                <p className={styles.disclaimer}>Los precios que ingresás son referencias tuyas, no cotizaciones actuales ni ofertas verificadas. Moneda de esta primera versión: ARS.</p>
              </article>
              <article className={styles.nextCard}>
                <span className={styles.eyebrow}>03 / PRÓXIMAMENTE</span>
                <h2>Compará antes de comprar</h2>
                <ul>
                  <li>Comercios cercanos y precios comparables</li>
                  <li>Descuentos con vigencia y condiciones verificadas</li>
                  <li>Mejor combinación de comercios para tu lista</li>
                  <li>Alternativas y precio por unidad</li>
                </ul>
                <div className={styles.sourceNote}>Esta sección todavía no muestra ofertas. Se activará al integrar fuentes autorizadas y comprobar la actualización de sus datos.</div>
              </article>
            </section>
          </>
        )}
        <a href="/vera" className={styles.footerLink}>Volver a conversar con VERA</a>
      </main>
    </div>
  );
}
