"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import MobileMenu from "./mobile-menu";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";
import CurrencyPicker from "./currency-picker";
import { useProfileCurrency } from "../lib/use-profile-currency";

type Account = { id: string; name: string; currency: string; is_archived?: boolean };
type Movement = { id: string; goal_id: string; type: "income" | "expense"; amount: number; currency: string; goal_amount: number; exchange_rate: number; rate_source: string; rate_at: string; category: string; description: string | null; movement_date: string; status: "pending" | "posted" | "cancelled"; source: string; recurring_rule_id: string | null; recurring_mode?: "confirmation" | "automatic" | null; verification_status: "not_required" | "pending" | "verified"; verified_at: string | null };
type RecurringRule = { id: string; goal_id: string; currency: string; account_id: string | null; type: "income" | "expense"; amount: number; category: string; description: string | null; frequency: string; mode: "confirmation" | "automatic"; status: "active" | "paused" | "completed"; interval_days: number | null; schedule_day: number | null; start_date: string; end_date: string | null; next_run_date: string };
type Goal = {
  id: string;
  title: string;
  target_amount: number;
  currency: string;
  target_date: string | null;
  status: "active" | "paused" | "completed";
  saved_amount: number;
  remaining_amount: number;
  progress_percent: number;
  currency_breakdown?: Array<{ currency: string; amount: number; equivalent_amount: number; percentage: number }>;
  unconverted_movements_count?: number;
  currency_rates_updated_at?: string | null;
  currency_rates_source?: string | null;
  movements: Movement[];
  recurring_rules: RecurringRule[];
};

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return currency + " " + amount.toLocaleString("es-AR"); }
}

export default function FinancialGoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [contributionAccountId, setContributionAccountId] = useState("");
  const [ruleAccountId, setRuleAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const profileCurrency = useProfileCurrency();
  useEffect(() => { setCurrency(profileCurrency); }, [profileCurrency]);
  const [targetDate, setTargetDate] = useState("");
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionError, setContributionError] = useState("");
  const [contributionCurrency, setContributionCurrency] = useState("ARS");
  const [contributionQuote, setContributionQuote] = useState<{ rate: number; source: string; at: string | null } | null>(null);
  const [contributionNote, setContributionNote] = useState("");
  useEffect(() => {
    if (!contributionGoal || contributionCurrency === contributionGoal.currency) {
      setContributionQuote(contributionGoal ? { rate: 1, source: "Misma moneda", at: null } : null);
      return;
    }
    let active = true;
    setContributionQuote(null);
    const params = new URLSearchParams({ base: contributionGoal.currency, symbols: contributionCurrency });
    fetch("/api/global-currency-rates?" + params.toString(), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No hay cotización disponible.");
        const quotedRate = payload.rates?.[contributionCurrency];
        if (typeof quotedRate !== "number" || quotedRate <= 0 || payload.stale?.[contributionCurrency] === true) throw new Error("No hay una cotización vigente.");
        if (active) setContributionQuote({ rate: 1 / quotedRate, source: payload.source ?? "ExchangeRate.dev", at: payload.data_updated_at ?? null });
      })
      .catch(() => { if (active) setContributionQuote(null); });
    return () => { active = false; };
  }, [contributionGoal?.currency, contributionCurrency]);
  const contributionParsedAmount = parseLocalizedAmount(contributionAmount);
  const contributionPreviewAmount = contributionParsedAmount !== null && contributionParsedAmount > 0 && contributionQuote
    ? contributionParsedAmount * contributionQuote.rate : null;

  const [correctionGoal, setCorrectionGoal] = useState<Goal | null>(null);
  const [correctionMovement, setCorrectionMovement] = useState<Movement | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionCategory, setCorrectionCategory] = useState("");
  const [correctionDescription, setCorrectionDescription] = useState("");
  const [correctionDate, setCorrectionDate] = useState("");
  const [movementType, setMovementType] = useState<"income" | "expense">("income");
  const [movementCategory, setMovementCategory] = useState("Ahorro");
  const [movementDate, setMovementDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }));
  const [recurringGoal, setRecurringGoal] = useState<Goal | null>(null);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [ruleType, setRuleType] = useState<"income" | "expense">("income");
  const [ruleAmount, setRuleAmount] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState("ARS");
  const [ruleCategory, setRuleCategory] = useState("Ahorro");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleFrequency, setRuleFrequency] = useState("monthly");
  const [ruleMode, setRuleMode] = useState<"confirmation" | "automatic">("confirmation");
  const [ruleStartDate, setRuleStartDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }));
  const [ruleEndDate, setRuleEndDate] = useState("");
  const [ruleScheduleDay, setRuleScheduleDay] = useState(String(new Date().getDate()));
  const [ruleIntervalDays, setRuleIntervalDays] = useState("30");

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
      setAccounts(data.accounts ?? []);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const planResponse = await fetch("/api/user-plan", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (planResponse.ok) {
          const planData = await planResponse.json();
          setIsPremium(planData.plan === "premium" && planData.active === true);
        } else {
          setIsPremium(false);
        }
      } else {
        setIsPremium(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar tus objetivos.");
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);
  const isAnyGoalModalOpen = Boolean(recurringGoal || correctionGoal || contributionGoal);
  useEffect(() => {
    if (!isAnyGoalModalOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isAnyGoalModalOpen]);


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
    setSaving(true); setNotice(""); setContributionError("");
    try {
      await request("POST", { action: "movement", goalId: contributionGoal.id, type: movementType, amount, currency: contributionCurrency, category: movementCategory, description: contributionNote.trim(), movementDate, accountId: contributionAccountId || null });
      setContributionGoal(null); setContributionAccountId(""); setContributionAmount(""); setContributionNote(""); setMovementType("income"); setMovementCategory("Ahorro");
      window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice("Movimiento registrado. El progreso del objetivo fue actualizado.");
      await loadGoals();
    } catch (err) {
      setContributionError(err instanceof Error ? err.message : "No pudimos registrar el movimiento. Intentá nuevamente.");
    } finally { setSaving(false); }
  }

  function openRecurringRule(goal: Goal, rule?: RecurringRule) {
    setRecurringGoal(goal);
    setEditingRule(rule ?? null);
    setRuleType(rule?.type ?? "income");
    setRuleAmount(rule ? String(rule.amount) : "");
    setRuleCurrency(rule?.currency ?? goal.currency);
    setRuleCategory(rule?.category ?? "Ahorro");
    setRuleDescription(rule?.description ?? "");
    setRuleFrequency(rule?.frequency ?? "monthly");
    setRuleMode(rule?.mode ?? "confirmation");
    setRuleStartDate(rule?.start_date ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }));
    setRuleEndDate(rule?.end_date ?? "");
    setRuleScheduleDay(String(rule?.schedule_day ?? new Date().getDate()));
    setRuleIntervalDays(String(rule?.interval_days ?? 30));
    setRuleAccountId(rule?.account_id ?? "");
    setNotice("");
  }

  async function saveRecurringRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recurringGoal) return;
    const amount = parseLocalizedAmount(ruleAmount);
    const intervalDays = Number(ruleIntervalDays);
    const scheduleDay = Number(ruleScheduleDay);
    if (amount === null || amount <= 0 || !ruleCategory.trim()) {
      setNotice("Revisá el importe y la categoría de la regla.");
      return;
    }
    if (ruleFrequency === "custom" && (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)) {
      setNotice("El intervalo personalizado debe estar entre 1 y 365 días.");
      return;
    }
    setSaving(true); setNotice("");
    const payload = {
      action: "recurring_rule", goalId: recurringGoal.id, type: ruleType, amount, currency: ruleCurrency,
      category: ruleCategory.trim(), description: ruleDescription.trim(),
      frequency: ruleFrequency, mode: ruleMode, startDate: ruleStartDate,
      endDate: ruleEndDate || null, scheduleDay: ruleFrequency === "monthly" ? scheduleDay : null,
      intervalDays: ruleFrequency === "custom" ? intervalDays : null,
      accountId: ruleAccountId || null,
    };
    try {
      if (editingRule) await request("PATCH", { ...payload, ruleId: editingRule.id });
      else await request("POST", payload);
      setRecurringGoal(null); setEditingRule(null);
      setNotice(editingRule ? "Regla recurrente actualizada." : "Regla recurrente creada.");
      await loadGoals();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos guardar la regla recurrente.");
    } finally { setSaving(false); }
  }

  async function changeRecurringStatus(goal: Goal, rule: RecurringRule, status: "active" | "paused" | "completed") {
    setNotice("");
    try {
      await request("PATCH", { action: "recurring_rule", goalId: goal.id, ruleId: rule.id, status });
      setNotice(status === "paused" ? "Regla pausada." : status === "active" ? "Regla reanudada." : "Regla finalizada.");
      await loadGoals();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos actualizar la regla.");
    }
  }

  async function changeStatus(goal: Goal, status: "active" | "paused" | "completed") {
    setNotice("");
    try { await request("PATCH", { id: goal.id, status }); await loadGoals(); }
    catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos actualizar el objetivo."); }
  }

  async function updateRecurringMovement(goal: Goal, movement: Movement, status: "posted" | "cancelled") {
    setNotice("");
    try {
      await request("PATCH", { action: "movement_status", goalId: goal.id, movementId: movement.id, status });
      if (status === "posted") window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice(status === "posted" ? "Movimiento recurrente confirmado y sumado al progreso." : "Movimiento recurrente cancelado.");
      await loadGoals();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos actualizar el movimiento.");
    }
  }

  function openMovementCorrection(goal: Goal, movement: Movement) {
    setCorrectionGoal(goal);
    setCorrectionMovement(movement);
    setCorrectionAmount(String(movement.amount));
    setCorrectionCategory(movement.category);
    setCorrectionDescription(movement.description ?? "");
    setCorrectionDate(movement.movement_date);
    setNotice("");
  }

  async function saveMovementCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctionGoal || !correctionMovement) return;
    const amount = parseLocalizedAmount(correctionAmount);
    if (amount === null || amount <= 0 || !correctionCategory.trim() || !correctionDate) {
      setNotice("Revisá el importe, la categoría y la fecha.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      await request("PATCH", {
        action: "correct_automatic_movement", goalId: correctionGoal.id,
        movementId: correctionMovement.id, amount, category: correctionCategory.trim(),
        description: correctionDescription.trim(), movementDate: correctionDate,
      });
      setCorrectionGoal(null);
      setCorrectionMovement(null);
      window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice("Movimiento corregido. Volvé a comprobarlo para confirmar que coincide con tu operación.");
      await loadGoals();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos corregir el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyAutomaticMovement(goal: Goal, movement: Movement) {
    setNotice("");
    try {
      await request("PATCH", { action: "verify_automatic_movement", goalId: goal.id, movementId: movement.id });
      setNotice("Movimiento comprobado. El progreso no cambió porque ya estaba registrado.");
      await loadGoals();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos comprobar el movimiento.");
    }
  }

  async function deleteContribution(goal: Goal, movement: Movement) {
    if (movement.source !== "manual") return;
    if (!window.confirm("¿Eliminar este movimiento del historial del objetivo?")) return;
    setNotice("");
    try {
      await request("DELETE", { id: goal.id, movementId: movement.id });
      window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice("Movimiento eliminado y progreso recalculado.");
      await loadGoals();
    } catch (err) { setNotice(err instanceof Error ? err.message : "No pudimos eliminar el aporte."); }
  }

  async function deleteGoal(goal: Goal) {
    if (!window.confirm(`¿Eliminar “${goal.title}” y el historial asociado al objetivo? Los movimientos generales que ya se registraron se conservarán en Movimientos y en los saldos de sus cuentas. Esta acción no se puede deshacer.`)) return;
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
          <div><p className="goals-eyebrow">NUEVA META</p><h2>¿Qué querés alcanzar?</h2><p>El progreso suma los ingresos confirmados y descuenta los gastos registrados.</p></div>
          <form onSubmit={createGoal} className="goals-form">
            <label>Nombre del objetivo<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Ej. Comprar una computadora" required /></label>
            <div className="goals-form-row">
              <label>Importe objetivo<input value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 500.000" required /></label>
              <label>Moneda<CurrencyPicker value={currency} onChange={setCurrency} label="Moneda del objetivo" /></label>
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
                <div className="goal-progress-caption"><strong>{goal.progress_percent.toLocaleString("es-AR")}%</strong><span>{goal.movements.filter((entry) => entry.status === "posted").length} movimientos confirmados</span></div>
                {(goal.currency_breakdown?.length ?? 0) > 0 && <section className="goal-currency-breakdown" aria-label="Distribución de ahorros por moneda"><strong>Distribución de ahorros</strong><div>{goal.currency_breakdown!.map((item) => <span key={item.currency}><b>{item.currency} · {item.percentage.toLocaleString("es-AR")}%</b><small>{money(item.amount, item.currency)} · {money(item.equivalent_amount, goal.currency)} equivalentes</small></span>)}</div></section>}
                {(goal.currency_breakdown?.length ?? 0) > 0 && <small className="goal-currency-rate-note">Cotizaciones indicativas · {goal.currency_rates_source ?? "ExchangeRate.dev"} · {goal.currency_rates_updated_at ? new Date(goal.currency_rates_updated_at).toLocaleString("es-AR") : "fecha de actualización no informada"}</small>}
                {(goal.unconverted_movements_count ?? 0) > 0 && <p className="goals-disclaimer">{goal.unconverted_movements_count} movimiento(s) no se incluyen en el progreso porque no hay una cotización confiable disponible.</p>}
                {goal.status === "active" && <button className="goals-primary goals-contribute" onClick={() => { setContributionGoal(goal); setContributionCurrency(goal.currency); setContributionAccountId(""); setContributionError(""); setNotice(""); }}>＋ Registrar ingreso o gasto</button>}
                {goal.movements.some((entry) => entry.source === "recurring" && entry.status === "posted" && entry.verification_status === "pending") && <section className="goal-verification-alert" aria-label="Movimientos automáticos por comprobar">
                  <strong>Comprobá tus movimientos automáticos</strong>
                  <p>VERA registró estos movimientos en el progreso del objetivo. Revisá que coincidan con tus operaciones reales.</p>
                  {goal.movements.filter((entry) => entry.source === "recurring" && entry.status === "posted" && entry.verification_status === "pending").map((entry) => <div className="goal-verification-row" key={entry.id}>
                    <span>{new Date(entry.movement_date + "T12:00:00").toLocaleDateString("es-AR")} · {entry.category} · {entry.type === "income" ? "Ingreso" : "Gasto"}</span>
                    <strong>{money(Number(entry.amount), entry.currency || goal.currency)}</strong>
                    <button type="button" onClick={() => openMovementCorrection(goal, entry)}>Corregir</button>
                    <button type="button" onClick={() => void verifyAutomaticMovement(goal, entry)}>Ya lo comprobé</button>
                  </div>)}
                </section>}
                {goal.movements.length > 0 && <details className="goal-history"><summary>Ver historial de movimientos</summary>{goal.movements.map((entry) => <div className="goal-history-row" key={entry.id}><span>{new Date(entry.movement_date + "T12:00:00").toLocaleDateString("es-AR")} · {entry.category}{entry.description ? ` · ${entry.description}` : ""}{entry.status !== "posted" ? ` · ${entry.status === "pending" ? "Pendiente" : "Cancelado"}` : ""}{entry.source === "recurring" ? (entry.recurring_mode === "automatic" ? (entry.verification_status === "verified" ? " · Automático comprobado" : " · Automático pendiente de comprobación") : " · Recurrente confirmado") : entry.source === "legacy" ? " · Histórico" : ""}</span><strong>{entry.type === "income" ? "+" : "−"} {money(Number(entry.amount), entry.currency || goal.currency)}{(entry.currency || goal.currency) !== goal.currency && <small> ≈ {money(Number(entry.goal_amount), goal.currency)} al objetivo</small>}</strong>{entry.source === "manual" && <button type="button" onClick={() => void deleteContribution(goal, entry)} aria-label="Eliminar movimiento">Eliminar</button>}{entry.source === "recurring" && entry.status === "pending" && <span className="goal-pending-actions"><button type="button" onClick={() => void updateRecurringMovement(goal, entry, "posted")}>Confirmar</button><button type="button" onClick={() => void updateRecurringMovement(goal, entry, "cancelled")}>Cancelar</button></span>}</div>)}</details>}
                <section className="goal-projection" aria-label="Proyección de cumplimiento"><h4>Proyección de cumplimiento</h4>
                  {goal.recurring_rules.some((rule) => rule.status === "active") ? (() => {
                    const factors: Record<string, number> = { daily: 30.4375, weekly: 4.348, every_15_days: 2.03, monthly: 1, every_2_months: 0.5, every_3_months: 1/3, every_6_months: 1/6, yearly: 1/12 };
                    const activeRules = goal.recurring_rules.filter((rule) => rule.status === "active");
                    const monthlyNet = activeRules.filter((rule) => (rule.currency || goal.currency) === goal.currency).reduce((sum, rule) => {
                      const factor = rule.frequency === "custom" ? (rule.interval_days ? 30.4375 / rule.interval_days : 0) : (factors[rule.frequency] ?? 0);
                      return sum + (rule.type === "income" ? 1 : -1) * Number(rule.amount) * factor;
                    }, 0);
                    const estimate = (multiplier: number) => {
                      const net = monthlyNet * multiplier;
                      if (net <= 0 || goal.remaining_amount <= 0) return null;
                      const months = Math.ceil(goal.remaining_amount / net);
                      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() + months);
                      return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
                    };
                    return <><p>Flujo recurrente neto estimado: <strong>{money(monthlyNet, goal.currency)}/mes</strong></p><div className="goal-projection-grid"><span>Conservador<strong>{estimate(0.8) ?? "Sin fecha estimable"}</strong></span><span>Esperado<strong>{estimate(1) ?? "Sin fecha estimable"}</strong></span><span>Optimista<strong>{estimate(1.2) ?? "Sin fecha estimable"}</strong></span></div><small>Estimación orientativa basada en reglas recurrentes activas en {goal.currency}. No es una garantía y no cuenta movimientos pendientes. {activeRules.some((rule) => (rule.currency || goal.currency) !== goal.currency) ? "Las reglas en otras monedas no se incluyen en esta proyección." : ""}</small></>;
                  })() : <p>Agregá ingresos y gastos recurrentes para que VERA pueda estimar una fecha de cumplimiento. Los movimientos aislados no se proyectan como ingresos futuros.</p>}
                </section>
                {goal.status === "active" && <button className="goals-secondary goal-recurring-add" onClick={() => openRecurringRule(goal)}>＋ Agregar ingreso o gasto recurrente</button>}
                {goal.recurring_rules.length > 0 && <details className="goal-recurring-list"><summary>Reglas recurrentes ({goal.recurring_rules.length})</summary>
                  {goal.recurring_rules.map((rule) => <div className="goal-recurring-row" key={rule.id}>
                    <div className="goal-recurring-info"><strong>{rule.type === "income" ? "Ingreso" : "Gasto"} · {money(Number(rule.amount), rule.currency || goal.currency)}</strong>
                      <span>{rule.category} · {({ daily: "Diario", weekly: "Semanal", every_15_days: "Cada 15 días", monthly: "Mensual", every_2_months: "Cada 2 meses", every_3_months: "Cada 3 meses", every_6_months: "Cada 6 meses", yearly: "Anual", custom: "Personalizado" } as Record<string, string>)[rule.frequency] ?? rule.frequency} · {rule.mode === "confirmation" ? "Requiere confirmación" : "Automático no verificado"}</span>
                      <small>Próxima fecha: {new Date(rule.next_run_date + "T12:00:00").toLocaleDateString("es-AR")} · {rule.status === "active" ? "Activa" : rule.status === "paused" ? "En pausa" : "Finalizada"}</small>
                    </div>
                    {rule.status !== "completed" && <div className="goal-recurring-actions">
                      <button type="button" onClick={() => openRecurringRule(goal, rule)}>Editar</button>
                      {rule.status === "active" ? <button type="button" onClick={() => void changeRecurringStatus(goal, rule, "paused")}>Pausar</button> : <button type="button" onClick={() => void changeRecurringStatus(goal, rule, "active")}>Reanudar</button>}
                      <button type="button" onClick={() => void changeRecurringStatus(goal, rule, "completed")}>Finalizar</button>
                    </div>}
                  </div>)}
                </details>}
                <div className="goal-actions">{goal.status === "active" ? <button onClick={() => void changeStatus(goal, "paused")}>Pausar</button> : goal.status === "paused" ? <button onClick={() => void changeStatus(goal, "active")}>Reanudar</button> : null}{goal.status !== "completed" && goal.saved_amount >= goal.target_amount && <button onClick={() => void changeStatus(goal, "completed")}>Marcar completado</button>}<button className="goal-delete" onClick={() => void deleteGoal(goal)}>Eliminar</button></div>
              </article>
            ))}
          </section>
        )}
      </main>

      {recurringGoal && <div className="goals-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setRecurringGoal(null); }}>
        <section className="goals-modal" role="dialog" aria-modal="true" aria-labelledby="goal-recurring-title">
          <button className="goals-modal-close" onClick={() => setRecurringGoal(null)} disabled={saving} aria-label="Cerrar">×</button>
          <p className="goals-eyebrow">PLANIFICACIÓN AUTOMÁTICA</p>
          <h2 id="goal-recurring-title">{editingRule ? "Editar regla recurrente" : "Nueva regla recurrente"}</h2>
          <p className="goals-modal-description">{recurringGoal.title}</p>
          <form onSubmit={saveRecurringRule} className="goals-form">
            <label>Tipo<select value={ruleType} onChange={(event) => { setRuleType(event.target.value as "income" | "expense"); setRuleCategory(event.target.value === "income" ? "Ahorro" : "Servicios"); }}><option value="income">Ingreso</option><option value="expense">Gasto</option></select></label>
            <label>Importe<input value={ruleAmount} onChange={(event) => setRuleAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 50.000" required /></label>
            <label>Moneda de la regla<CurrencyPicker value={ruleCurrency} onChange={(code) => { setRuleCurrency(code); setRuleAccountId(""); }} label="Moneda de la regla" variant="light" /></label>
            <label>Categoría<input value={ruleCategory} onChange={(event) => setRuleCategory(event.target.value)} maxLength={60} required /></label>
            <label>Descripción <span>(opcional)</span><input value={ruleDescription} onChange={(event) => setRuleDescription(event.target.value)} maxLength={240} placeholder="Detalle de la regla" /></label>
            <label>Frecuencia<select value={ruleFrequency} onChange={(event) => setRuleFrequency(event.target.value)}>
              <option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="every_15_days">Cada 15 días</option><option value="monthly">Mensual</option><option value="every_2_months">Cada 2 meses</option><option value="every_3_months">Cada 3 meses</option><option value="every_6_months">Cada 6 meses</option><option value="yearly">Anual</option><option value="custom">Personalizada</option>
            </select></label>
            {ruleFrequency === "monthly" && <label>Día del mes<input type="number" min="1" max="31" value={ruleScheduleDay} onChange={(event) => setRuleScheduleDay(event.target.value)} required /></label>}
            {ruleFrequency === "custom" && <label>Repetir cada (días)<input type="number" min="1" max="365" value={ruleIntervalDays} onChange={(event) => setRuleIntervalDays(event.target.value)} required /></label>}
            <label>Modalidad<select value={ruleMode} onChange={(event) => setRuleMode(event.target.value as "confirmation" | "automatic")}><option value="confirmation">Pedir confirmación antes de registrar</option><option value="automatic">Registro automático no verificado</option></select></label>
            <label>Cuenta asociada<select value={ruleAccountId} onChange={(event) => setRuleAccountId(event.target.value)} disabled={!isPremium}><option value="">Sin cuenta (no modifica saldos)</option>{isPremium && accounts.filter((account) => account.currency === ruleCurrency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            {!isPremium && <p className="goals-disclaimer">Vincular una cuenta para actualizar su saldo es una función Premium. Podés crear la regla sin asociar una cuenta.</p>}
            <label>Fecha de inicio<input type="date" value={ruleStartDate} onChange={(event) => setRuleStartDate(event.target.value)} required /></label>
            <label>Fecha de finalización <span>(opcional)</span><input type="date" value={ruleEndDate} min={ruleStartDate} onChange={(event) => setRuleEndDate(event.target.value)} /></label>
            <button className="goals-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : editingRule ? "Guardar cambios" : "Crear regla recurrente"}</button>
          </form>
          <p className="goals-disclaimer">Al llegar la fecha, VERA registra el movimiento en el historial general y actualiza el objetivo. Si elegís una cuenta, también modifica su saldo registrado; si elegís “Sin cuenta”, no modifica saldos. No realiza transferencias bancarias. Los registros automáticos quedan pendientes de comprobación.</p>
        </section>
      </div>}
      {correctionGoal && correctionMovement && <div className="goals-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setCorrectionGoal(null); setCorrectionMovement(null); } }}>
        <section className="goals-modal" role="dialog" aria-modal="true" aria-labelledby="goal-correction-title">
          <button className="goals-modal-close" onClick={() => { setCorrectionGoal(null); setCorrectionMovement(null); }} disabled={saving} aria-label="Cerrar">×</button>
          <p className="goals-eyebrow">REVISIÓN DE MOVIMIENTO</p>
          <h2 id="goal-correction-title">Corregir registro automático</h2>
          <p className="goals-modal-description">{correctionGoal.title}</p>
          <form onSubmit={saveMovementCorrection} className="goals-form">
            <label>Importe<input value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} inputMode="decimal" required /></label>
            <label>Categoría<input value={correctionCategory} onChange={(event) => setCorrectionCategory(event.target.value)} maxLength={60} required /></label>
            <label>Descripción <span>(opcional)</span><input value={correctionDescription} onChange={(event) => setCorrectionDescription(event.target.value)} maxLength={240} /></label>
            <label>Fecha<input type="date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} required /></label>
            <button className="goals-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar corrección"}</button>
          </form>
          <p className="goals-disclaimer">La corrección recalcula el progreso y deja el movimiento pendiente de comprobación.</p>
        </section>
      </div>}
      {contributionGoal && <div className="goals-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setContributionGoal(null); }}><section className="goals-modal" role="dialog" aria-modal="true" aria-labelledby="goal-contribution-title"><button className="goals-modal-close" onClick={() => setContributionGoal(null)} disabled={saving} aria-label="Cerrar">×</button><p className="goals-eyebrow">ACTUALIZAR PROGRESO</p><h2 id="goal-contribution-title">Registrar movimiento</h2><p className="goals-modal-description">{contributionGoal.title}</p><form onSubmit={addContribution} className="goals-form"><label>Tipo de movimiento<select value={movementType} onChange={(event) => { setMovementType(event.target.value as "income" | "expense"); setMovementCategory(event.target.value === "income" ? "Ahorro" : "Compras"); }}><option value="income">Ingreso</option><option value="expense">Gasto</option></select></label><label>Importe<input value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 15.000" required /></label><label>Moneda del movimiento<CurrencyPicker value={contributionCurrency} onChange={(code) => { setContributionCurrency(code); setContributionAccountId(""); }} label="Moneda del movimiento" variant="dark" /></label>{contributionGoal && contributionCurrency !== contributionGoal.currency && <p className="goals-disclaimer" aria-live="polite">{contributionPreviewAmount !== null ? <>Equivalente estimado: <strong>{money(contributionPreviewAmount, contributionGoal.currency)}</strong>. Cotización indicativa de {contributionQuote?.source}; al confirmar se guardará la cotización aplicada.</> : "Consultando una cotización vigente. Si no está disponible, no se registrará el movimiento."}</p>}<label>Categoría<input value={movementCategory} onChange={(event) => setMovementCategory(event.target.value)} maxLength={60} placeholder="Ej. Trabajo, transporte..." required /></label><label>Fecha<input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} required /></label><label>Cuenta asociada<select value={contributionAccountId} onChange={(event) => setContributionAccountId(event.target.value)} disabled={!isPremium}><option value="">Sin cuenta (no modifica saldos)</option>{isPremium && accounts.filter((account) => account.currency === contributionCurrency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>{!isPremium && <p className="goals-disclaimer">Vincular una cuenta para actualizar su saldo es una función Premium. Podés registrar el movimiento sin asociar una cuenta.</p>}<label>Descripción <span>(opcional)</span><input value={contributionNote} onChange={(event) => setContributionNote(event.target.value)} maxLength={240} placeholder="Detalle del movimiento" /></label>{contributionError && <p className="goals-disclaimer" role="alert" aria-live="assertive" style={{ color: "#ff8b8b", overflowWrap: "anywhere" }}>{contributionError}</p>}<button className="goals-primary" type="submit" disabled={saving}>{saving ? "Guardando..." : "Confirmar movimiento"}</button></form><p className="goals-disclaimer">El movimiento también aparecerá en Movimientos. Si elegís una cuenta, se reflejará en su saldo registrado; “Sin cuenta” evita modificar saldos. No se realiza ninguna transferencia bancaria.</p></section></div>}
    </div>
  );
}
