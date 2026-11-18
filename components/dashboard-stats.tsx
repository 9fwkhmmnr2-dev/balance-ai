"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Movement = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  movement_date: string;
  description: string;
  category: string;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("es-AR")}`;
  }
}

export default function DashboardStats() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currency, setCurrency] = useState("");
  const [currencies, setCurrencies] = useState(["ARS"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError("");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("No pudimos verificar tu sesión.");
      const { data: profile, error: profileError } = await supabase.from("financial_profiles").select("currency").eq("user_id", userData.user.id).maybeSingle();
      if (profileError) throw profileError;
      const preferred = profile?.currency || "ARS";
      const { data, error: movementError } = await supabase.from("movements").select("id, type, amount, currency, movement_date, description, category").order("movement_date", { ascending: false }).order("created_at", { ascending: false });
      if (movementError) throw movementError;
      const rows = (data ?? []) as Movement[];
      setMovements(rows);
      setCurrencies(Array.from(new Set([preferred, ...rows.map((row) => row.currency)])));
      setCurrency((current) => current || preferred);
    } catch {
      setError("No pudimos cargar tus datos financieros. Intentá recargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const refresh = () => { void loadData(); };
    window.addEventListener("finance:movement-saved", refresh);
    return () => window.removeEventListener("finance:movement-saved", refresh);
  }, [loadData]);

  const selected = useMemo(() => movements.filter((item) => item.currency === currency), [movements, currency]);
  const now = new Date();
  const monthKey = dateKey(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7);
  const monthly = selected.filter((item) => item.movement_date?.slice(0, 7) === monthKey);
  const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = monthly.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const monthlyNet = income - expenses;
  const allTimeNet = selected.reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * Number(item.amount), 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = dateKey(date);
    const dayItems = selected.filter((item) => item.movement_date?.slice(0, 10) === key);
    return {
      key,
      label: date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
      income: dayItems.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0),
      expenses: dayItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0)
    };
  });
  const maxDay = Math.max(1, ...days.flatMap((day) => [day.income, day.expenses]));
  const recent = selected.slice(0, 5);

  if (loading) return <section className="card">Preparando tu panorama financiero...</section>;
  if (error) return <section className="card"><p>{error}</p><button className="text-button" onClick={() => { setLoading(true); void loadData(); }}>Reintentar</button></section>;

  return (
    <div className="dashboard-overview">
      <section className="dashboard-identity-card" aria-label="FINANCE.AI">
        <div className="dashboard-identity-brand">FINANCE<span>.</span>AI</div>
        <p>Entendé qué está pasando con tu dinero.</p>
      </section>

      <section className="overview-heading">
        <div>
          <p className="eyebrow">RESUMEN PERSONAL</p>
          <h2>Tu dinero, en perspectiva.</h2>
          <p>Un vistazo claro a lo que ingresó y salió este mes.</p>
        </div>
        <label className="currency-picker">Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </section>

      <section className="dashboard-balance-card">
        <div>
          <p className="balance-kicker">BALANCE NETO REGISTRADO · ESTE MES</p>
          <h2>{money(monthlyNet, currency)}</h2>
          <p className="balance-caption">{monthlyNet > 0 ? "Registraste más ingresos que gastos." : monthlyNet < 0 ? "Tus gastos registrados superan tus ingresos." : "Tus ingresos y gastos registrados están equilibrados."}</p>
        </div>
        <div className="balance-period"><span>Balance acumulado</span><strong>{money(allTimeNet, currency)}</strong><small>Desde tus primeros movimientos</small></div>
      </section>

      <section className="stats-grid dashboard-stat-cards">
        <article className="card stat-card income-stat-card"><p className="card-label">Ingresos del mes</p><h3 className="card-value">{money(income, currency)}</h3><p className="card-note">Total registrado este mes</p></article>
        <article className="card stat-card expense-stat-card"><p className="card-label">Gastos del mes</p><h3 className="card-value">{money(expenses, currency)}</h3><p className="card-note">Total registrado este mes</p></article>
        <article className="card stat-card movements-stat-card"><p className="card-label">Movimientos del mes</p><h3 className="card-value">{monthly.length}</h3><p className="card-note">Registros en {now.toLocaleDateString("es-AR", { month: "long" })}</p></article>
      </section>

      <section className="vera-insight-card">
        <div className="vera-insight-top"><span className="vera-mark">V</span><div><p className="eyebrow">VERA · LECTURA FINANCIERA</p><h3>{monthly.length === 0 ? "Empecemos a entender tus finanzas." : monthlyNet > 0 ? "Tu balance mensual está en positivo." : monthlyNet < 0 ? "Este mes tus gastos superan tus ingresos." : "Tu balance mensual está equilibrado."}</h3></div><span className="insight-status">Análisis básico</span></div>
        <p>{monthly.length === 0 ? "Cuando registres ingresos y gastos, vamos a poder mostrarte tendencias y observaciones basadas en tus propios movimientos." : monthlyNet > 0 ? `Hasta ahora registraste ${money(monthlyNet, currency)} más en ingresos que en gastos durante este mes. Seguí registrando tus movimientos para observar cómo evoluciona.` : monthlyNet < 0 ? `La diferencia entre tus ingresos y gastos registrados es de ${money(Math.abs(monthlyNet), currency)}. Revisá las categorías de gasto para entender qué está impulsando el resultado.` : "Por ahora, los ingresos y gastos que registraste durante este mes tienen el mismo total."}</p>
        <small>Esta lectura se calcula con tus movimientos registrados; todavía no es una respuesta de IA.</small>
      </section>

      <div className="dashboard-lower-grid">
        <section className="card activity-card">
          <div className="section-heading"><div><p className="eyebrow">ÚLTIMA SEMANA</p><h3>Actividad de tus movimientos</h3></div><span className="chart-legend"><i className="legend-income" /> Ingresos <i className="legend-expense" /> Gastos</span></div>
          {days.every((day) => day.income === 0 && day.expenses === 0) ? <p className="empty-state">Todavía no hay movimientos registrados en los últimos siete días.</p> : <div className="weekly-chart">{days.map((day) => <div className="weekly-day" key={day.key}><div className="weekly-bars"><span className="weekly-bar income-bar" style={{ height: `${Math.max(day.income / maxDay * 100, day.income > 0 ? 5 : 0)}%` }} title={`Ingresos: ${money(day.income, currency)}`} /><span className="weekly-bar expense-bar" style={{ height: `${Math.max(day.expenses / maxDay * 100, day.expenses > 0 ? 5 : 0)}%` }} title={`Gastos: ${money(day.expenses, currency)}`} /></div><span>{day.label}</span></div>)}</div>}
        </section>
        <section className="card recent-card"><div className="section-heading"><div><p className="eyebrow">REGISTRO</p><h3>Movimientos recientes</h3></div></div>{recent.length === 0 ? <p className="empty-state">Tus movimientos aparecerán acá cuando registres el primero.</p> : recent.map((item) => <div className="recent-movement" key={item.id}><span className={`movement-dot ${item.type === "income" ? "dot-income" : "dot-expense"}`} /><div className="recent-description"><strong>{item.description}</strong><small>{item.category} · {item.movement_date}</small></div><b className={item.type === "income" ? "amount-income" : "amount-expense"}>{item.type === "income" ? "+" : "−"}{money(Number(item.amount), currency)}</b></div>)}</section>
      </div>
      <p className="dashboard-disclaimer">Los importes se muestran por moneda y se basan únicamente en los movimientos que registraste en FINANCE AI. No representan saldos bancarios.</p>
    </div>
  );
}
