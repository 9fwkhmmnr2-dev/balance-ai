"use client";

import { useState } from "react";
import styles from "./vera-gold-demo.module.css";

type Stage = "plan" | "checkout" | "welcome" | "complete";
type Billing = "monthly" | "yearly";

const plans = {
  monthly: { label: "Mensual", price: "USD 3,99", period: "por mes", total: "USD 3,99" },
  yearly: { label: "Anual", price: "USD 39,99", period: "por año", total: "USD 39,99" },
};

export default function VeraGoldDemo() {
  const [stage, setStage] = useState<Stage>("plan");
  const [billing, setBilling] = useState<Billing>("yearly");
  const selected = plans[billing];

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <a href="/vera/gold">← VERA GOLD</a>
        <span>ENTORNO DE DEMOSTRACIÓN</span>
      </div>

      <div className={styles.notice}>
        <span className={styles.noticeDot} />
        SIMULACIÓN · No se realiza ningún cobro ni se activa una suscripción real
      </div>

      <div className={styles.progress} aria-label="Progreso de la demostración">
        {(["plan", "checkout", "welcome", "complete"] as Stage[]).map((item, index) => (
          <span key={item} className={stage === item ? styles.progressActive : stage === "plan" || ["plan", "checkout", "welcome", "complete"].indexOf(stage) > index ? styles.progressDone : ""} />
        ))}
      </div>

      {stage === "plan" && (
        <section className={styles.panel}>
          <div className={styles.eyebrow}>FINANCETRACK / VERA</div>
          <div className={styles.miniOrb} aria-hidden="true"><span /></div>
          <p className={styles.kicker}>UNA EXPERIENCIA MÁS PROFUNDA</p>
          <h1>Conocé <em>VERA GOLD.</em></h1>
          <p className={styles.lead}>La misma VERA. Más capacidad para explorar tus finanzas con profundidad.</p>
          <div className={styles.planChoices}>
            {(["monthly", "yearly"] as Billing[]).map((option) => (
              <button key={option} type="button" onClick={() => setBilling(option)} className={billing === option ? styles.planSelected : styles.plan}>
                <span className={styles.planRadio} />
                <span className={styles.planName}>{plans[option].label}</span>
                <strong>{plans[option].price}</strong>
                <small>{plans[option].period}</small>
                {option === "yearly" && <span className={styles.recommended}>ANUAL</span>}
              </button>
            ))}
          </div>
          <div className={styles.summary}><span>Total de prueba</span><strong>{selected.total}</strong></div>
          <button className={styles.primary} onClick={() => setStage("checkout")}>Continuar <span>→</span></button>
          <p className={styles.fine}>Precios ilustrativos para probar el recorrido. No son una oferta comercial.</p>
        </section>
      )}

      {stage === "checkout" && (
        <section className={styles.panel}>
          <button className={styles.back} onClick={() => setStage("plan")}>← Volver a los planes</button>
          <p className={styles.kicker}>RESUMEN DE LA SIMULACIÓN</p>
          <h1>Tu acceso a <em>GOLD.</em></h1>
          <div className={styles.order}>
            <div><span>Plan seleccionado</span><strong>VERA GOLD · {selected.label}</strong></div>
            <div><span>Importe ilustrativo</span><strong>{selected.total}</strong></div>
            <div><span>Medio de pago</span><strong>Pago de prueba (sin conexión)</strong></div>
          </div>
          <div className={styles.secureNote}><span>◇</span><p>Este checkout es exclusivamente visual. No solicita datos de pago, no se conecta a PayPal y no envía información.</p></div>
          <button className={styles.primary} onClick={() => { window.location.assign("/vera?goldDemo=1"); }}>Simular pago exitoso <span>→</span></button>
          <button className={styles.secondary} onClick={() => setStage("plan")}>Cancelar demostración</button>
        </section>
      )}

      {stage === "welcome" && (
        <section className={styles.welcome}>
          <div className={styles.cinematicOrb} aria-hidden="true">
            <span className={styles.orbHalo} /><span className={styles.orbRing} /><span className={styles.orbBody} />
          </div>
          <p className={styles.kicker}>SIMULACIÓN COMPLETADA</p>
          <h1>Una nueva luz.<br /><em>La misma VERA.</em></h1>
          <p className={styles.lead}>La energía violeta se transforma. VERA GOLD cobra vida.</p>
          <button className={styles.primary} onClick={() => setStage("complete")}>Entrar a la experiencia <span>→</span></button>
          <p className={styles.fine}>La animación de bienvenida es una vista previa. Tu plan real no cambia.</p>
        </section>
      )}

      {stage === "complete" && (
        <section className={styles.panel}>
          <div className={styles.finalOrb} aria-hidden="true"><span /></div>
          <p className={styles.kicker}>VISTA PREVIA GOLD</p>
          <h1>Bienvenido a <em>VERA GOLD.</em></h1>
          <p className={styles.lead}>Esta demostración termina acá. Tu cuenta continúa con el plan que tenía antes de comenzar.</p>
          <div className={styles.finalTag}>✦ GOLD · MODO DEMOSTRACIÓN</div>
          <a className={styles.primaryLink} href="/vera">Volver a VERA <span>→</span></a>
          <button className={styles.secondary} onClick={() => { setStage("plan"); setBilling("yearly"); }}>Repetir demostración</button>
        </section>
      )}

      <footer className={styles.footer}>FINANCETRACK <span>Your money. Your vision.</span></footer>
    </main>
  );
}
