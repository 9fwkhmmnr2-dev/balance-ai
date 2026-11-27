"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./vera-gold.module.css";

const features = [
  ["Cuentas, movimientos y transferencias", true, true],
  ["Presupuestos y objetivos básicos", true, true],
  ["VERA: consultas básicas", true, true],
  ["Resumen mensual básico", true, true],
  ["Notificaciones esenciales", true, true],
  ["Mayor capacidad para conversar y contexto ampliado", false, true],
  ["Comparación avanzada de períodos y tendencias", false, true],
  ["Simulador de compras, pagos y decisiones", false, true],
  ["Planificación personalizada de objetivos", false, true],
  ["Lector de imágenes y PDF con contexto escrito", false, true],
  ["Cierre mensual inteligente con VERA", false, true],
  ["VERA: Modo Ahorro — lista y presupuesto inteligente", false, true],
  ["Comparador de comercios y descuentos verificados", false, "En desarrollo"],
  ["Optimización de compras entre varios comercios", false, "En desarrollo"],
  ["Notificaciones personalizadas y alertas avanzadas", false, "En desarrollo"],
  ["Análisis de archivos XLSX, CSV y DOCX", false, "En desarrollo"],
] as const;

export default function FinancePlusView() {
  const [isPreview, setIsPreview] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/vera/entitlement", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json() as { isPlus?: boolean; accountId?: string; previewOnly?: boolean };
      if (!active) return;
      setIsPreview(Boolean(result.previewOnly));
      setIsPlus(Boolean(result.isPlus));
      setAccountId(result.accountId ?? "");
    })();
    return () => { active = false; };
  }, []);

  function requestPreviewAccess() {
    if (!accountId) return;
    void navigator.clipboard?.writeText(accountId);
    setNotice("ID de cuenta copiado. Enviálo para habilitar FINANCE PLUS temporalmente en esta Preview. No se realiza ningún cobro.");
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.back} href="/vera">← Volver a VERA</a>
        <span className={styles.topTag}>FINANCETRACK / VERA</span>
      </header>
      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>UNA VERA CON MÁS CAPACIDAD</p>
          <div className={styles.wordmark}>VERA <span>FINANCE PLUS</span></div>
          <h1>Más profundidad para entender tu dinero.</h1>
          <p>La misma VERA que ya conocés, con más capacidad para sostener conversaciones y profundizar tus análisis.</p>
        </section>

        <section className={styles.checkout}>
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>NUEVO MÓDULO PLUS</span><h2>VERA: Modo Ahorro</h2></div>
            <span className={styles.goldPill}>EXCLUSIVO PLUS</span>
          </div>
          <p className={styles.note}>Prepará tu lista, definí un presupuesto y organizá tus compras. El comparador de precios y promociones se activará cuando existan fuentes verificadas.</p>
          <a className={styles.buyButton} href="/finance-plus/ahorro" style={{display:"block",textAlign:"center",textDecoration:"none"}}>Abrir Modo Ahorro →</a>
        </section>

        <section className={styles.checkout} aria-label="Comparar planes y elegir FINANCE PLUS">
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>COMPARÁ LOS PLANES</span><h2>Elegí tu experiencia</h2></div>
            <span className={styles.goldPill}>FINANCE PLUS</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.comparison}>
              <thead><tr><th>Incluye</th><th>FINANCE FREE</th><th>FINANCE PLUS</th></tr></thead>
              <tbody>{features.map(([name, free, plus]) => (
                <tr key={name}><td>{name}</td><td>{free ? <span className={styles.check}>✓</span> : "—"}</td><td>{plus === true ? <span className={styles.check}>✓</span> : plus}</td></tr>
              ))}</tbody>
            </table>
          </div>

          <div className={styles.prices}>
            <article className={styles.priceCard}>
              <span>Mensual · precio propuesto</span>
              <strong>USD 3,99<small>/mes</small></strong>
              <p>Cancelación mensual cuando la suscripción esté habilitada.</p>
            </article>
            <article className={styles.priceCard}>
              <span>Anual · precio propuesto</span>
              <strong>USD 39,99<small>/año</small></strong>
              <p>Equivale a USD 3,33 por mes.</p>
            </article>
          </div>

          <div className={styles.payment}>
            <strong>Medios de pago previstos</strong>
            <p>Tarjeta y PayPal. La disponibilidad final, moneda de cobro e impuestos se confirmarán antes de habilitar la compra.</p>
          </div>
          {isPreview ? (
            <button className={styles.buyButton} type="button" onClick={requestPreviewAccess} disabled={isPlus || !accountId}>
              {isPlus ? "FINANCE PLUS de prueba activo" : "Solicitar acceso FINANCE PLUS de prueba"}
            </button>
          ) : (
            <button className={styles.buyButton} type="button" disabled aria-disabled="true">Comprar FINANCE PLUS · Próximamente</button>
          )}
          {notice && <p role="status" className={styles.note}>{notice}</p>}
          <p className={styles.note}>Todavía no se realizan cobros ni se solicitan tarjetas. En Preview, el acceso de prueba se habilita individualmente. Los precios son orientativos y las funciones marcadas “En preparación” aún no están disponibles.</p>
          <a className={styles.backToVera} href="/vera">Volver a VERA</a>
        </section>
      </main>
    </div>
  );
}
