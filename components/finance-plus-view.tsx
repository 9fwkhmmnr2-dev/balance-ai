"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./finance-plus.module.css";

const features = [
  ["Cuentas, movimientos y transferencias", true, true],
  ["Presupuestos y objetivos básicos", true, true],
  ["VERA: consultas básicas", true, true],
  ["VERA FREE: 20 mensajes/día · hasta 40 créditos acumulados", true, false],
  ["VERA PLUS: 100 mensajes/día · hasta 200 créditos acumulados", false, true],
  ["Contexto conversacional de hasta 12 mensajes", true, false],
  ["Contexto conversacional de hasta 32 mensajes", false, true],
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
              <span>Mensual · precio objetivo orientativo</span>
              <strong>USD 6,99<small>/mes</small></strong>
              <p>Suscripción mensual. Precio sujeto a validación y sin cobros habilitados.</p>
            </article>
            <article className={styles.priceCard}>
              <span>Anual · precio objetivo orientativo</span>
              <strong>USD 59,99<small>/año</small></strong>
              <p>Equivale a USD 5,00 por mes; casi 30% menos que doce pagos mensuales al precio objetivo.</p>
            </article>
          </div>

          <div className={styles.payment}>
            <strong>Modalidades de suscripción y medios de pago</strong>
            <p>Podrás elegir entre pago mensual o anual. Tarjeta y PayPal son medios previstos, sujetos a confirmar con el proveedor de cobro. La moneda final, impuestos, renovación automática, cancelación y reembolsos se informarán antes de contratar.</p>
            <p><strong>Precio beta en evaluación:</strong> USD 3,99 por mes o USD 29,99 por año. No está activo ni garantizado; sus condiciones y duración deberán definirse antes de ofrecerlo.</p>
          </div>
          {isPreview ? (
            <button className={styles.buyButton} type="button" onClick={requestPreviewAccess} disabled={isPlus || !accountId}>
              {isPlus ? "FINANCE PLUS de prueba activo" : "Solicitar acceso FINANCE PLUS de prueba"}
            </button>
          ) : (
            <button className={styles.buyButton} type="button" disabled aria-disabled="true">Comprar FINANCE PLUS · Próximamente</button>
          )}
          {notice && <p role="status" className={styles.note}>{notice}</p>}
          <p className={styles.note}>Todavía no se realizan cobros ni se solicitan tarjetas. La comparación está disponible también para cuentas FREE. En Preview, el acceso especial de prueba se habilita individualmente y no equivale a una suscripción paga. Los precios son orientativos y las funciones marcadas “En desarrollo” aún no están disponibles. Las alertas esenciales, la seguridad y los controles de privacidad no dependen de PLUS.</p>
          <a className={styles.backToVera} href="/vera">Volver a VERA</a>
        </section>
      </main>
    </div>
  );
}
