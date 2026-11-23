"use client";

import styles from "./vera-gold.module.css";

const features = [
  ["Consultas financieras habituales", true, true],
  ["Resumen y análisis de gastos", true, true],
  ["Comparación básica de períodos", true, true],
  ["Objetivos con aportes manuales", true, true],
  ["Progreso automático desde una cuenta vinculada", false, "Exclusivo GOLD · En preparación"],
  ["Mayor capacidad para conversar", false, true],
  ["Análisis financieros más profundos", false, true],
  ["Análisis avanzado de documentos", false, "En preparación"],
  ["Planificación y seguimiento avanzado", false, "En preparación"],
] as const;

export default function VeraGoldView() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.back} href="/vera">← Volver a VERA</a>
        <span className={styles.topTag}>FINANCETRACK / VERA</span>
      </header>
      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>UNA VERA CON MÁS CAPACIDAD</p>
          <div className={styles.wordmark}>VERA <span>GOLD</span></div>
          <h1>Más profundidad para entender tu dinero.</h1>
          <p>La misma VERA que ya conocés, con más capacidad para sostener conversaciones y profundizar tus análisis.</p>
        </section>

        <section className={styles.checkout} aria-label="Comparar planes y elegir VERA GOLD">
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>COMPARÁ LOS PLANES</span><h2>Elegí tu experiencia</h2></div>
            <span className={styles.goldPill}>VERA GOLD</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.comparison}>
              <thead><tr><th>Incluye</th><th>VERA</th><th>GOLD</th></tr></thead>
              <tbody>{features.map(([name, free, gold]) => (
                <tr key={name}><td>{name}</td><td>{free ? <span className={styles.check}>✓</span> : "—"}</td><td>{gold === true ? <span className={styles.check}>✓</span> : gold}</td></tr>
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
          <button className={styles.buyButton} type="button" disabled aria-disabled="true">Comprar GOLD · Próximamente</button>
          <p className={styles.note}>Todavía no se realizan cobros. Estamos terminando de integrar y verificar el sistema de pago. Los precios son orientativos y las funciones marcadas “En preparación” aún no están disponibles.</p>
          <a className={styles.backToVera} href="/vera">Volver a VERA</a>
        </section>
      </main>
    </div>
  );
}
