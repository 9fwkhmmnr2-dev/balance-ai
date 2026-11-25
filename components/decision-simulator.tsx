"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./decision-simulator.module.css";

type Snapshot = {
  currency: string; from: string; to: string; movementsCount: number;
  monthlyIncome: number; monthlyExpenses: number; monthlyNet: number;
  topExpenses: Array<{ category: string; monthlyAmount: number }>;
};

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${Math.round(value).toLocaleString("es-AR")}`; }
}
function amount(value: string, fallback: number) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function DecisionSimulator() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extraIncome, setExtraIncome] = useState("0");
  const [expenseReduction, setExpenseReduction] = useState("0");
  const [target, setTarget] = useState("500000");
  const [startingSavings, setStartingSavings] = useState("0");
  const [months, setMonths] = useState(12);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
        const response = await fetch("/api/vera/simulator", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No pudimos cargar tus datos.");
        if (active) setSnapshot(payload as Snapshot);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "No pudimos cargar el simulador.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const result = useMemo(() => {
    if (!snapshot) return null;
    const income = snapshot.monthlyIncome + amount(extraIncome, 0);
    const expenses = Math.max(0, snapshot.monthlyExpenses - amount(expenseReduction, 0));
    const monthlySavings = income - expenses;
    const initial = amount(startingSavings, 0);
    const goal = amount(target, 0);
    const total = initial + monthlySavings * months;
    const baseTotal = initial + snapshot.monthlyNet * months;
    const remaining = Math.max(0, goal - initial);
    const monthsToGoal = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : null;
    return { income, expenses, monthlySavings, total, baseTotal, goal, monthsToGoal, progress: goal > 0 ? Math.min(100, Math.max(0, total / goal * 100)) : 0 };
  }, [snapshot, extraIncome, expenseReduction, target, startingSavings, months]);

  if (loading) return <section className={styles.page}><p className={styles.muted}>Preparando tu simulador...</p></section>;
  if (error) return <section className={styles.page}><a className={styles.back} href="/vera">← Volver a VERA</a><h1>Simulador de decisiones</h1><p className={styles.error}>{error}</p><p className={styles.muted}>Esta herramienta está incluida en VERA GOLD.</p></section>;
  if (!snapshot || !result) return null;

  return (
    <section className={styles.page}>
      <header className={styles.header}><a className={styles.back} href="/vera">← Volver a VERA</a><span className={styles.tag}>VERA / GOLD</span></header>
      <div className={styles.intro}><p className={styles.eyebrow}>PLANIFICACIÓN INTELIGENTE</p><h1>Simulador de decisiones</h1><p>Probá distintos escenarios antes de tomar una decisión. Todo es una estimación: no se crean movimientos ni se modifican tus cuentas.</p></div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.eyebrow}>AJUSTÁ TU ESCENARIO</p><h2>¿Qué querés probar?</h2>
          <label>Ingreso adicional por mes <span>{snapshot.currency}</span><input inputMode="decimal" value={extraIncome} onChange={e => setExtraIncome(e.target.value)} /></label>
          <label>Reducción de gastos por mes <span>{snapshot.currency}</span><input inputMode="decimal" value={expenseReduction} onChange={e => setExpenseReduction(e.target.value)} /></label>
          <label>Ahorro que ya tenés <span>{snapshot.currency}</span><input inputMode="decimal" value={startingSavings} onChange={e => setStartingSavings(e.target.value)} /></label>
          <label>Objetivo que querés alcanzar <span>{snapshot.currency}</span><input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /></label>
          <label>Plazo <strong>{months} meses</strong><input type="range" min="1" max="36" value={months} onChange={e => setMonths(Number(e.target.value))} /></label>
        </article>

        <article className={styles.panel}>
          <p className={styles.eyebrow}>RESULTADO ESTIMADO</p><h2>Tu escenario</h2>
          <div className={styles.heroMetric}><span>Ahorro mensual proyectado</span><strong>{money(result.monthlySavings, snapshot.currency)}</strong></div>
          <div className={styles.metrics}>
            <div><span>Al final del plazo</span><strong>{money(result.total, snapshot.currency)}</strong></div>
            <div><span>Escenario actual</span><strong>{money(result.baseTotal, snapshot.currency)}</strong></div>
            <div><span>Diferencia</span><strong className={result.total >= result.baseTotal ? styles.positive : styles.negative}>{money(result.total - result.baseTotal, snapshot.currency)}</strong></div>
            <div><span>Tiempo para el objetivo</span><strong>{result.monthsToGoal === null ? "No alcanzable con este escenario" : result.monthsToGoal === 0 ? "Ya alcanzado" : `${result.monthsToGoal} meses`}</strong></div>
          </div>
          <div className={styles.progressHead}><span>Progreso del objetivo</span><strong>{result.progress.toFixed(1)}%</strong></div><div className={styles.track}><div style={{ width: `${result.progress}%` }} /></div>
          <p className={styles.disclaimer}>Proyección lineal basada en los promedios de los últimos 90 días. No contempla inflación, intereses, impuestos ni cambios inesperados.</p>
        </article>
      </div>

      <article className={styles.panel + " " + styles.history}>
        <div className={styles.historyHead}><div><p className={styles.eyebrow}>DATOS DE REFERENCIA</p><h2>Tu actividad reciente</h2></div><span>{snapshot.movementsCount} movimientos · últimos 90 días</span></div>
        <div className={styles.metrics}><div><span>Ingreso mensual promedio</span><strong>{money(snapshot.monthlyIncome, snapshot.currency)}</strong></div><div><span>Gasto mensual promedio</span><strong>{money(snapshot.monthlyExpenses, snapshot.currency)}</strong></div><div><span>Balance mensual promedio</span><strong>{money(snapshot.monthlyNet, snapshot.currency)}</strong></div></div>
        {snapshot.topExpenses.length > 0 && <div className={styles.categories}><h3>Principales categorías de gasto</h3>{snapshot.topExpenses.map(item => <div className={styles.category} key={item.category}><span>{item.category}</span><strong>{money(item.monthlyAmount, snapshot.currency)}</strong></div>)}</div>}
        <p className={styles.disclaimer}>Los datos se consultan en modo lectura y solo consideran movimientos de la moneda principal de tu perfil.</p>
      </article>
    </section>
  );
}
