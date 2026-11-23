"use client";

import styles from "./vera-gold.module.css";

export default function VeraGoldView() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.back} href="/vera">← Volver a VERA</a>
        <span className={styles.topTag}>FINANCETRACK / VERA</span>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>✦ UNA EXPERIENCIA MÁS PROFUNDA</p>
            <div className={styles.wordmark}>VERA <span>GOLD</span></div>
            <h1>Entendé más. Decidí con más claridad.</h1>
            <p className={styles.heroText}>La misma VERA, con mayor capacidad para sostener conversaciones, profundizar análisis y trabajar con información financiera compleja.</p>
            <div className={styles.benefits}>
              <div><strong>Análisis más profundos</strong><span>Informes extensos y comparaciones con más contexto.</span></div>
              <div><strong>Más capacidad para conversar</strong><span>Más margen para preguntar y continuar un análisis.</span></div>
              <div><strong>Documentos y planificación</strong><span>Herramientas avanzadas a medida que estén disponibles.</span></div>
            </div>
          </div>
          <div className={styles.orb} aria-hidden="true"><div className={styles.orbRing}/><div className={styles.orbCore}>V</div></div>
        </section>

        <section className={styles.offer} aria-label="Precio y formas de pago de VERA GOLD">
          <div className={styles.offerIntro}>
            <p className={styles.eyebrow}>PLAN PREMIUM</p>
            <h2>VERA GOLD</h2>
            <p>Una propuesta simple, sin bloquear las funciones esenciales de VERA Free.</p>
          </div>
          <div className={styles.priceGrid}>
            <article className={styles.priceCard}>
              <span>Mensual · propuesta</span>
              <strong>USD 3,99<small>/mes</small></strong>
              <p>Flexibilidad mes a mes.</p>
            </article>
            <article className={styles.priceCard}>
              <span>Anual · propuesta</span>
              <strong>USD 39,99<small>/año</small></strong>
              <p>Equivale a USD 3,33 por mes.</p>
            </article>
          </div>
          <div className={styles.paymentInfo}>
            <strong>Medios de pago previstos</strong>
            <span>Tarjeta y PayPal, sujetos a habilitación y verificación.</span>
          </div>
          <div className={styles.reference}>
            <span>Referencia de mercado</span>
            <p>ChatGPT Plus cuesta USD 20 al mes. Es una referencia de precio, no una equivalencia de funciones o servicios.</p>
          </div>
          <button className={styles.primaryButton} type="button" disabled>Comprar VERA GOLD · Próximamente</button>
          <p className={styles.disclaimer}>Precios y medios de pago orientativos. No se realiza ningún cobro ni se activa una suscripción desde esta pantalla. Las funciones avanzadas se habilitarán cuando estén listas.</p>
        </section>

        <section className={styles.demo}>
          <a className={styles.demoLink} href="/vera/gold/demo">Ver cómo se transforma VERA al activar GOLD →</a>
        </section>
      </main>
    </div>
  );
}
