"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import MobileMenu from "./mobile-menu";
import "./financial-goals.css";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";

type Contribution = { id: string; goal_id: string; amount: number; note: string | null; contributed_at: string };
type Goal = {
  id: string;
  title: string;
  target_amount: number;
  currency: "ARS" | "USD" | "EUR";
  target_date: string | null;
  status: "active" | "paused" | "completed";
  saved_amount: number;
  remaining_amount: number;
  progress_percent: number;
  contributions: Contribution[];
};

const currencies = ["ARS", "USD", "EUR"] as const;
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return currency + " " + amount.toLocaleString("es-AR"); }
}

export default function FinancialGoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("ARS");
  const [targetDate, setTargetDate] = useState("");
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");

  const request = useCallback(async (method: "GET" | "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
    const response = await fetch("/api/financial-goals", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No pudimos completar la operación.");
    return data;
  }, []);

  const loadGoals = useCallback(async () => {
    setError("");
    try {
      const data = await request("GET");
      setGoals(data.goals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar tus objetivos.");
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseLocalizedAmount(targetAmount);
    if (!title.trim() || title.trim().length > 80 || amount === null || amount <= 0) {
      setNotice("Revisá el nombre y el importe objetivo.");
      return;
    }
    setSaving(true); setNotice("");
    try {
      await request("POST", { title: title.trim(), targetAmount: amount, currency, targetDate: targetDate || null });
      setTitle(""); setTargetAmount(""); setTargetDate("");
      setNotice("Objetivo creado. Podés registrar tu primer aporte cuando quieras.");
      await loadGoals();
    } catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos crear el objetivo."); }
    finally { setSaving(false); }
  }

  async function addContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributionGoal) return;
    const amount = parseLocalizedAmount(contributionAmount);
    if (amount === null || amount <= 0) { setNotice("Ingresá un importe válido para el aporte."); return; }
    setSaving(true); setNotice("");
    try {
      await request("POST", { action: "contribute", goalId: contributionGoal.id, amount, note: contributionNote.trim() });
      setContributionGoal(null); setContributionAmount(""); setContributionNote("");
      setNotice("Aporte registrado. El progreso del objetivo fue actualizado.");
      await loadGoals();
    } catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos registrar el aporte."); }
    finally { setSaving(false); }
  }

  async function changeStatus(goal: Goal, status: "active" | "paused" | "completed") {
    setNotice("");
    try { await request("PATCH", { id: goal.id, status }); await loadGoals(); }
    catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos actualizar el objetivo."); }
  }

  async function deleteContribution(goal: Goal, contribution: Contribution) {
    if (!window.confirm("¿Eliminar este aporte del historial del objetivo?")) return;
    setNotice("");
    try {
      await request("DELETE", { id: goal.id, contributionId: contribution.id });
      setNotice("Aporte eliminado y progreso recalculado.");
      await loadGoals();
    } catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos eliminar el aporte."); }
  }

  async function deleteGoal(goal: Goal) {
    if (!window.confirm(`¿Eliminar “${goal.title}” y todo su historial de aportes? Esta acción no se puede deshacer.`)) return;
    setNotice("");
    try { await request("DELETE", { id: goal.id }); setNotice("Objetivo eliminado."); await loadGoals(); }
    catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos eliminar el objetivo."); }
  }

  return (
    <div className="goals-page">
      <MobileMenu />
      <header className="goals-nav">
        <a href="/" className="mobile-brand">FINANCE<span>.</span>TRACK</a>
        <nav><a href="/">Inicio</a><a href="/movimientos">Movimientos</a><a href="/cuentas">Mis cuentas</a><a href="/objetivos" aria-current="page">Objetivos</a><a href="/vera">VERA</a><a href="/perfil">Perfil</a></nav>
      </header>
      <main className="goals-main">
        <header className="goals-heading">
          <div><p className="goals-eyebrow">PLANIFICACIÓN FINANCIERA</p><h1>Mis objetivos</h1><p>Definí una meta y registrá cada aporte para seguir tu progreso.</p></div>
        </header>

        <section className="goals-create-card">
          <div><p className="goals-eyebrow">NUEVA META</p><h2>¿Qué querés alcanzar?</h2><p>El progreso se calcula únicamente con los aportes que registres.</p></div>
          <form onSubmit={createGoal} className="goals-form">
            <label>Nombre del objetivo<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Ej. Comprar una computadora" required /></label>
            <div className="goals-form-row">
              <label>Importe objetivo<input value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 500.000" required /></label>
              <label>Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value as (typeof currencies)[number])}>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            <label>Fecha objetivo <span>(opcional)</span><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} min={new Date().toISOString().slice(0, 10)} /></label>
            <button className="goals-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear objetivo"}</button>
          </form>
        </section>

        {notice && <p className="goals-notice" role="status">{notice}</p>}
        {loading ? <p className="goals-empty">Cargando tus objetivos...</p> : error ? <section className="goals-empty"><p>{error}</p><button className="goals-secondary" onClick={() => { setLoading(true); void loadGoals(); }}>Reintentar</button></section> : goals.length === 0 ? <section className="goals-empty"><h2>Todavía no tenés objetivos</h2><p>Creá tu primera meta y empezá a registrar los aportes que hagas.</p></section> : (
          <section className="goals-list">
            <div className="goals-list-heading"><div><p className="goals-eyebrow">TU PROGRESO</p><h2>Objetivos activos y pausados</h2></div><span>{goals.length} {goals.length === 1 ? "objetivo" : "objetivos"}</span></div>
            {goals.map((goal) => (
              <article className="goal-card" key={goal.id}>
                <div className="goal-card-top"><div><h3>{goal.title}</h3><p>{goal.target_date ? `Fecha objetivo: ${new Date(goal.target_date + "T12:00:00").toLocaleDateString("es-AR")}` : "Sin fecha límite"}</p></div><span className={`goal-status goal-status-${goal.status}`}>{goal.status === "active" ? "En curso" : goal.status === "paused" ? "En pausa" : "Completado"}</span></div>
                <div className="goal-amounts"><div><small>Acumulado</small><strong>{money(goal.saved_amount, goal.currency)}</strong></div><div><small>Objetivo</small><strong>{money(goal.target_amount, goal.currency)}</strong></div><div><small>Falta</small><strong>{money(goal.remaining_amount, goal.currency)}</strong></div></div>
                <div className="goal-progress-track" role="progressbar" aria-valuenow={goal.progress_percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${goal.title}`}><span style={{ width: `${goal.progress_percent}%` }} /></div>
                <div className="goal-progress-caption"><strong>{goal.progress_percent.toLocaleString("es-AR")}%</strong><span>{goal.contributions.length} {goal.contributions.length === 1 ? "aporte registrado" : "aportes registrados"}</span></div>
                {goal.status === "active" && <button className="goals-primary goals-contribute" onClick={() => { setContributionGoal(goal); setNotice(""); }}>＋ Registrar aporte</button>}
                {goal.contributions.length > 0 && <details className="goal-history"><summary>Ver historial de aportes</summary>{goal.contributions.map((entry) => <div className="goal-history-row" key={entry.id}><span>{new Date(entry.contributed_at + "T12:00:00").toLocaleDateString("es-AR")}{entry.note ? ` · ${entry.note}` : ""}</span><strong>+ {money(Number(entry.amount), goal.currency)}</strong><button type="button" onClick={() => void deleteContribution(goal, entry)} aria-label="Eliminar aporte">Eliminar</button></div>)}</details>}
                <div className="goal-actions">{goal.status === "active" ? <button onClick={() => void changeStatus(goal, "paused")}>Pausar</button> : goal.status === "paused" ? <button onClick={() => void changeStatus(goal, "active")}>Reanudar</button> : null}{goal.status !== "completed" && goal.saved_amount >= goal.target_amount && <button onClick={() => void changeStatus(goal, "completed")}>Marcar completado</button>}<button className="goal-delete" onClick={() => void deleteGoal(goal)}>Eliminar</button></div>
              </article>
            ))}
          </section>
        )}
      </main>

      {contributionGoal && <div className="goals-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setContributionGoal(null); }}><section className="goals-modal" role="dialog" aria-modal="true" aria-labelledby="goal-contribution-title"><button className="goals-modal-close" onClick={() => setContributionGoal(null)} disabled={saving} aria-label="Cerrar">×</button><p className="goals-eyebrow">ACTUALIZAR PROGRESO</p><h2 id="goal-contribution-title">Registrar aporte</h2><p className="goals-modal-description">{contributionGoal.title}</p><form onSubmit={addContribution} className="goals-form"><label>Importe aportado<input value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 15.000" required /></label><label>Nota <span>(opcional)</span><input value={contributionNote} onChange={(event) => setContributionNote(event.target.value)} maxLength={240} placeholder="Ej. Ahorro de noviembre" /></label><button className="goals-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Confirmar aporte"}</button></form><p className="goals-disclaimer">Este registro actualiza el progreso del objetivo, pero no mueve dinero ni modifica tus cuentas o movimientos.</p></section></div>}
    </div>
  );
}
