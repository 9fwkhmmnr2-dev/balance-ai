"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import MobileMenu from "./mobile-menu";

type Movement = {
  id: string;
  account_id: string | null;
  type: "income" | "expense";
  amount: number;
  currency: string;
  movement_date: string;
  description: string;
  category: string;
};

type Account = {
  id: string;
  name: string;
  currency: string;
  initial_balance: number;
  is_archived: boolean;
};

type Transfer = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
};
type Period = "daily" | "weekly" | "monthly" | "yearly";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currency, setCurrency] = useState("");
  const [currencies, setCurrencies] = useState(["ARS"]);
  const [period, setPeriod] = useState<Period>("monthly");
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
      const [
        { data: movementRows, error: movementError },
        { data: accountRows, error: accountError },
        { data: transferRows, error: transferError }
      ] = await Promise.all([
        supabase.from("movements").select("id, account_id, type, amount, currency, movement_date, description, category").eq("user_id", userData.user.id).order("movement_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("financial_accounts").select("id, name, currency, initial_balance, is_archived").eq("user_id", userData.user.id).order("created_at", { ascending: true }),
        supabase.from("account_transfers").select("from_account_id, to_account_id, amount").eq("user_id", userData.user.id)
      ]);
      if (movementError) throw movementError;
      if (accountError) throw accountError;
      if (transferError) throw transferError;
      const rows = (movementRows ?? []) as Movement[];
      setMovements(rows);
      setAccounts((accountRows ?? []) as Account[]);
      setTransfers((transferRows ?? []) as Transfer[]);
      setCurrencies(Array.from(new Set([preferred, ...(accountRows ?? []).map((row) => row.currency), ...rows.map((row) => row.currency)])));
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
    window.addEventListener("finance:transfer-saved", refresh);
    return () => {
      window.removeEventListener("finance:movement-saved", refresh);
      window.removeEventListener("finance:transfer-saved", refresh);
    };
  }, [loadData]);

  const selected = useMemo(() => movements.filter((item) => item.currency === currency), [movements, currency]);
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach((account) => {
      balances[account.id] = Number(account.initial_balance);
    });
    movements.forEach((movement) => {
      if (!movement.account_id || balances[movement.account_id] === undefined) return;
      balances[movement.account_id] += (movement.type === "income" ? 1 : -1) * Number(movement.amount);
    });
    transfers.forEach((transfer) => {
      if (balances[transfer.from_account_id] !== undefined) balances[transfer.from_account_id] -= Number(transfer.amount);
      if (balances[transfer.to_account_id] !== undefined) balances[transfer.to_account_id] += Number(transfer.amount);
    });
    return balances;
  }, [accounts, movements, transfers]);
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.is_archived && account.currency === currency),
    [accounts, currency]
  );
  const accountTotal = activeAccounts.reduce(
    (sum, account) => sum + (accountBalances[account.id] ?? Number(account.initial_balance)),
    0
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dateKey(today);
  const rangeStart = new Date(today);
  if (period === "weekly") rangeStart.setDate(rangeStart.getDate() - 6);
  if (period === "monthly") rangeStart.setDate(1);
  if (period === "yearly") rangeStart.setMonth(0, 1);
  const startKey = dateKey(rangeStart);
  const periodMovements = selected.filter((item) => item.movement_date?.slice(0, 10) >= startKey && item.movement_date?.slice(0, 10) <= todayKey);
  const income = periodMovements.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = periodMovements.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const periodNet = income - expenses;
  const allTimeNet = selected.reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * Number(item.amount), 0);
  const totals = (items: Movement[]) => ({
    income: items.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0),
    expenses: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0)
  });
  const chartData = period === "daily"
    ? [{ key: todayKey, label: "Hoy", ...totals(periodMovements) }]
    : period === "weekly"
      ? Array.from({ length: 7 }, (_, index) => {
          const date = new Date(rangeStart); date.setDate(date.getDate() + index);
          const key = dateKey(date);
          return { key, label: date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), ...totals(periodMovements.filter((item) => item.movement_date?.slice(0, 10) === key)) };
        })
      : period === "monthly"
        ? Array.from({ length: Math.ceil(now.getDate() / 7) }, (_, index) => ({
            key: "week-" + (index + 1), label: "Sem " + (index + 1),
            ...totals(periodMovements.filter((item) => Math.floor((Number(item.movement_date.slice(8, 10)) - 1) / 7) === index))
          }))
        : Array.from({ length: now.getMonth() + 1 }, (_, index) => ({
            key: "month-" + (index + 1),
            label: new Date(now.getFullYear(), index, 1).toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
            ...totals(periodMovements.filter((item) => Number(item.movement_date.slice(5, 7)) === index + 1))
          }));
  const maxBucket = Math.max(1, ...chartData.flatMap((bucket) => [bucket.income, bucket.expenses]));
  const recent = periodMovements.slice(0, 5);
  const periodLabel = ({ daily: "hoy", weekly: "esta semana", monthly: "este mes", yearly: "este año" } as const)[period];

  if (loading) return <section className="card">Preparando tu panorama financiero...</section>;
  if (error) return <section className="card"><p>{error}</p><button className="text-button" onClick={() => { setLoading(true); void loadData(); }}>Reintentar</button></section>;

  return (
    <div className="dashboard-overview">
      <section className="dashboard-identity-card" aria-label="FINANCETRACK">
        <MobileMenu />
        <div className="dashboard-identity-brand">FINANCE<span>.</span>TRACK</div>
        <p>Entendé qué está pasando con tu dinero.</p>
      </section>

      <section className="overview-heading">
        <div>
          <p className="eyebrow">RESUMEN PERSONAL</p>
          <h2>Tu dinero, en perspectiva.</h2>
          <p>Un vistazo claro a lo que ingresó y salió {periodLabel}.</p>
        </div>
        <label className="currency-picker">Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </section>

      <section className="dashboard-period-toolbar" aria-label="Período de análisis">
        <span>Período</span>
        <div className="dashboard-period-switch" role="group" aria-label="Filtrar dashboard por período">
          {([["daily", "Diario"], ["weekly", "Semanal"], ["monthly", "Mensual"], ["yearly", "Anual"]] as const).map(([value, label]) => (
            <button key={value} type="button" className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>
          ))}
        </div>
      </section>
      <section className="dashboard-balance-card">
        <div>
          <p className="balance-kicker">BALANCE NETO REGISTRADO · {period === "daily" ? "HOY" : period === "weekly" ? "ESTA SEMANA" : period === "monthly" ? "ESTE MES" : "ESTE AÑO"}</p>
          <h2>{money(periodNet, currency)}</h2>
          <p className="balance-caption">{periodNet > 0 ? "Registraste más ingresos que gastos en este período." : periodNet < 0 ? "Tus gastos registrados superan tus ingresos en este período." : "Tus ingresos y gastos registrados están equilibrados en este período."}</p>
        </div>
        <div className="balance-period"><span>Balance acumulado</span><strong>{money(allTimeNet, currency)}</strong><small>Desde tus primeros movimientos</small></div>
      </section>

      <section className="dashboard-accounts-section">
        <div className="section-heading">
          <div><p className="eyebrow">PATRIMONIO POR CUENTAS</p><h3>Tu dinero disponible</h3></div>
          <strong>{money(accountTotal, currency)}</strong>
        </div>
        {activeAccounts.length === 0 ? (
          <p className="empty-state">Todavía no tenés cuentas activas en {currency}. Podés agregarlas desde Mis cuentas.</p>
        ) : (
          <div className="dashboard-account-grid">
            {activeAccounts.map((account) => (
              <article className="dashboard-account-card" key={account.id}>
                <span>{account.name}</span>
                <strong>{money(accountBalances[account.id] ?? Number(account.initial_balance), currency)}</strong>
                <small>{account.currency}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="stats-grid dashboard-stat-cards">
        <article className="card stat-card income-stat-card"><p className="card-label">Ingresos {periodLabel}</p><h3 className="card-value">{money(income, currency)}</h3><p className="card-note">Total registrado en el período</p></article>
        <article className="card stat-card expense-stat-card"><p className="card-label">Gastos {periodLabel}</p><h3 className="card-value">{money(expenses, currency)}</h3><p className="card-note">Total registrado en el período</p></article>
        <article className="card stat-card movements-stat-card"><p className="card-label">Movimientos {periodLabel}</p><h3 className="card-value">{periodMovements.length}</h3><p className="card-note">Registros dentro del período</p></article>
      </section>

      <section className="vera-insight-card">
        <div className="vera-insight-top"><span className="vera-mark">V</span><div><p className="eyebrow">VERA · LECTURA FINANCIERA</p><h3>{periodMovements.length === 0 ? "Todavía no hay datos para este período." : periodNet > 0 ? "Tu balance está en positivo." : periodNet < 0 ? "Tus gastos superan tus ingresos." : "Tu balance está equilibrado."}</h3></div><span className="insight-status">Análisis básico</span></div>
        <p>{periodMovements.length === 0 ? "Cuando registres ingresos y gastos en este período, vamos a poder mostrarte tendencias basadas en tus movimientos." : periodNet > 0 ? "En " + periodLabel + " registraste " + money(periodNet, currency) + " más en ingresos que en gastos." : periodNet < 0 ? "La diferencia entre tus ingresos y gastos registrados " + periodLabel + " es de " + money(Math.abs(periodNet), currency) + ". Revisá tus categorías de gasto." : "Tus ingresos y gastos registrados " + periodLabel + " tienen el mismo total."}</p>
        <small>Esta lectura se calcula con tus movimientos registrados; todavía no es una respuesta de IA.</small>
      </section>

      <div className="dashboard-lower-grid">
        <section className="card activity-card">
          <div className="section-heading"><div><p className="eyebrow">ANÁLISIS DEL PERÍODO</p><h3>Ingresos y gastos</h3></div><span className="chart-legend"><i className="legend-income" /> Ingresos <i className="legend-expense" /> Gastos</span></div>
          {periodMovements.length === 0 ? <p className="empty-state">No hay movimientos registrados {periodLabel}.</p> : <div className={"period-chart period-chart-" + period}>{chartData.map((bucket) => <div className="period-column" key={bucket.key}><div className="period-bars"><span className="weekly-bar income-bar" style={{ height: Math.max(bucket.income / maxBucket * 100, bucket.income > 0 ? 5 : 0) + "%" }} title={"Ingresos: " + money(bucket.income, currency)} /><span className="weekly-bar expense-bar" style={{ height: Math.max(bucket.expenses / maxBucket * 100, bucket.expenses > 0 ? 5 : 0) + "%" }} title={"Gastos: " + money(bucket.expenses, currency)} /></div><span>{bucket.label}</span></div>)}</div>}
        </section>
        <section className="card recent-card"><div className="section-heading"><div><p className="eyebrow">REGISTRO</p><h3>Movimientos del período</h3></div></div>{recent.length === 0 ? <p className="empty-state">No hay movimientos para mostrar en este período.</p> : recent.map((item) => <div className="recent-movement" key={item.id}><span className={`movement-dot ${item.type === "income" ? "dot-income" : "dot-expense"}`} /><div className="recent-description"><strong>{item.description}</strong><small>{item.category} · {item.movement_date}</small></div><b className={item.type === "income" ? "amount-income" : "amount-expense"}>{item.type === "income" ? "+" : "−"}{money(Number(item.amount), currency)}</b></div>)}</section>
      </div>
      <p className="dashboard-disclaimer">Los importes se muestran por moneda y se basan únicamente en tus movimientos registrados. Las transferencias entre tus cuentas no se cuentan como ingresos ni gastos.</p>
    </div>
  );
}
