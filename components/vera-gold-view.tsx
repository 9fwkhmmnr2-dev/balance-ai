"use client";

import styles from "./vera-gold.module.css";

const benefits = [
  {
    number: "01",
    title: "Análisis más profundos",
    description: "Informes con más contexto, explicaciones detalladas y relaciones entre tus ingresos, gastos, compromisos y objetivos.",
    detail: "Más que ver los números: entender qué significan."
  },
  {
    number: "02",
    title: "Más capacidad para conversar",
    description: "Más margen para hacer preguntas, profundizar un tema y continuar análisis extensos sin perder el hilo.",
    detail: "Una conversación financiera con más recorrido."
  },
  {
    number: "03",
    title: "Documentos financieros",
    description: "Análisis de extractos, resúmenes, contratos y planillas compatibles, con extracción y explicación de la información.",
    detail: "La información importante, explicada con claridad."
  },
  {
    number: "04",
    title: "Memoria y contexto ampliados",
    description: "Más contexto sobre tus preferencias, objetivos y decisiones para que VERA pueda dar continuidad a tus planes.",
    detail: "Menos repeticiones. Más continuidad."
  },
  {
    number: "05",
    title: "Planificación avanzada",
    description: "Escenarios, simulaciones y seguimiento más detallado para evaluar alternativas antes de tomar decisiones.",
    detail: "Explorá posibilidades sin promesas ni resultados garantizados."
  },
  {
    number: "06",
    title: "Seguimiento inteligente",
    description: "Análisis más completos de hábitos, compromisos y posibles irregularidades para ayudarte a detectar qué merece atención.",
    detail: "Señales claras, siempre con sus fuentes y contexto."
  }
];

const comparison = [
  ["Gestión de cuentas y movimientos", "Incluido", "Incluido"],
  ["Consultas financieras con VERA", "Uso estándar", "Mayor capacidad"],
  ["Resúmenes y análisis básicos", "Incluido", "Incluido"],
  ["Informes extensos y análisis profundo", "—", "Ampliado"],
  ["Análisis de documentos", "—", "Incluido"],
  ["Memoria y contexto", "Básico", "Ampliado"],
  ["Simulaciones y planificación avanzada", "—", "Ampliado"]
];

export default function VeraGoldView() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.back} href="/vera">← Volver a VERA</a>
        <span className={styles.topTag}>FINANCETRACK / VERA</span>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.eyebrow}><span /> UNA EXPERIENCIA MÁS PROFUNDA</div>
          <div className={styles.wordmark}>VERA <span>GOLD</span></div>
          <h1>Tu dinero tiene más para contarte.</h1>
          <p className={styles.heroText}>
            La misma VERA que ya conocés, con más capacidad para analizar,
            conectar información y acompañar tus decisiones financieras.
          </p>
          <a className={styles.primaryButton} href="#beneficios">Explorar GOLD <span>↓</span></a>
          <p className={styles.heroNote}>Una sola VERA. Más profundidad cuando la necesitás.</p>
          <div className={styles.heroOrb} aria-hidden="true">
            <div className={styles.orbRing} />
            <div className={styles.orbCore}>V</div>
            <div className={styles.orbShine} />
          </div>
        </section>

        <section className={styles.intro} id="beneficios">
          <p className={styles.sectionEyebrow}>MÁS CAPACIDAD. MISMA CLARIDAD.</p>
          <h2>De entender tus finanzas a <span>explorarlas en profundidad.</span></h2>
          <p>
            GOLD amplía las herramientas de VERA para quienes necesitan análisis
            más completos, conversaciones más extensas y una visión conectada de
            su información financiera.
          </p>
        </section>

        <section className={styles.benefitGrid} aria-label="Beneficios de VERA GOLD">
          {benefits.map((benefit) => (
            <article className={styles.benefit} key={benefit.number}>
              <span className={styles.benefitNumber}>{benefit.number}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
              <span className={styles.benefitDetail}>{benefit.detail}</span>
            </article>
          ))}
        </section>

        <section className={styles.comparisonSection}>
          <div className={styles.comparisonHeading}>
            <p className={styles.sectionEyebrow}>DOS PLANES. UNA MISMA BASE.</p>
            <h2>Elegí cuánto querés profundizar.</h2>
            <p>El plan gratuito seguirá siendo útil para organizar tus finanzas y resolver consultas cotidianas.</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Función</th><th>VERA Free</th><th className={styles.goldColumn}>VERA GOLD</th></tr>
              </thead>
              <tbody>
                {comparison.map(([feature, free, gold]) => (
                  <tr key={feature}>
                    <td>{feature}</td><td>{free}</td><td className={styles.goldColumn}>{gold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.tableNote}>Las funciones GOLD se habilitarán cuando estén implementadas y disponibles. La comparación no representa funciones activas todavía.</p>
        </section>

        <section className={styles.promoExample}>
          <div className={styles.promoLabel}>ASÍ APARECERÁ GOLD EN FINANCETRACK</div>
          <div className={styles.promoCard}>
            <span className={styles.promoMark}>VERA <b>GOLD</b></span>
            <h3>¿Querés profundizar este informe?</h3>
            <p>Con GOLD, VERA podrá ampliar este análisis, conectar patrones entre períodos y desarrollar conclusiones con más contexto.</p>
            <span className={styles.promoLink}>Conocer VERA GOLD <span>→</span></span>
          </div>
          <p className={styles.promoFoot}>Promociones contextuales y discretas. Sin ventanas invasivas ni interrupciones.</p>
        </section>

        <section className={styles.comingSoon}>
          <div className={styles.comingLine} />
          <p className={styles.sectionEyebrow}>PRÓXIMAMENTE</p>
          <h2>Una nueva profundidad para tus finanzas.</h2>
          <p>Estamos preparando VERA GOLD. La disponibilidad, el precio y las condiciones se comunicarán antes de habilitar cualquier suscripción.</p>
          <a href="/vera" className={styles.secondaryButton}>Seguir usando VERA</a>
        </section>

        <footer className={styles.footer}>
          <span>FINANCETRACK</span>
          <span>Your money. Your vision.</span>
        </footer>
      </main>
    </div>
  );
}
