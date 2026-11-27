"use client";

import { useEffect, useState } from "react";
import styles from "./vera-gold-context-promo.module.css";

type Props = {
  plan: "free" | "gold";
};

const PROMO_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "vera-gold-dashboard-promo-last-shown";

export default function VeraGoldContextPromo({ plan }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (plan === "gold") return;

    try {
      const lastShown = Number(window.localStorage.getItem(STORAGE_KEY) || 0);
      const now = Date.now();
      if (lastShown && now - lastShown < PROMO_COOLDOWN_MS) return;
      window.localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Si el almacenamiento local no está disponible, priorizamos mostrar el aviso.
    }

    setVisible(true);
  }, [plan]);

  if (plan === "gold" || !visible) return null;

  return (
    <aside className={styles.promo} aria-label="Información sobre VERA GOLD">
      <button className={styles.dismiss} type="button" onClick={() => setVisible(false)} aria-label="Cerrar recomendación">×</button>
      <div className={styles.heading}>
        <span className={styles.mark}>V</span>
        <span className={styles.brand}>VERA <strong>GOLD</strong></span>
        <span className={styles.context}>PARA PROFUNDIZAR ESTE ANÁLISIS</span>
      </div>
      <h3>Ya tenés un panorama. El siguiente paso es encontrar conexiones.</h3>
      <p>
        Con GOLD estamos preparando análisis más profundos que podrán relacionar
        tus gastos, comparar períodos y sumar tus compromisos y objetivos a la lectura.
      </p>
      <a href="/vera/gold" className={styles.link}>Mejorar a GOLD <span aria-hidden="true">→</span></a>
      <small>Tu informe actual sigue disponible. Compará los planes y consultá el precio en una sola pantalla.</small>
    </aside>
  );
}
