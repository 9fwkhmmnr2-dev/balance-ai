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
type Transfer = { from_account_id: string; to_account_id: string; amount: number };
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
function shortDate(value: string) {
  if (!value) return "";
  const date = new Date(value + "T12:00:00");
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }).replace(".", "");
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
    accounts.forEach((account) => { balances[account.id] = Number(account.initial_balance); });
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
  const activeAccountIds = useMemo(() => new Set(activeAccounts.map((account) => account.id)), [activeAccounts]);
  const accountTotal = activeAccounts.reduce((sum, account) => sum + (accountBalances[account.id] ?? Number(account.initial_balance)), 0);
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
  const recent = selected.slice(0, 5);
  const periodLabel = ({ daily: "hoy", weekly: "esta semana", monthly: "este mes", yearly: "este año" } as const)[period];

  const categoryData = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    periodMovements.filter((item) => item.type === "expense").forEach((item) => {
      const category = item.category?.trim() || "Sin categoría";
      totalsByCategory.set(category, (totalsByCategory.get(category) ?? 0) + Number(item.amount));
    });
    return Array.from(totalsByCategory, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [periodMovements]);
  const maxCategory = Math.max(1, ...categoryData.map((item) => item.amount));
  const accountPositiveTotal = activeAccounts.reduce((sum, account) => sum + Math.max(0, accountBalances[account.id] ?? 0), 0);

  const openingBalanceAtRange = activeAccounts.reduce((sum, account) => sum + Number(account.initial_balance), 0)
    + selected.filter((item) => item.account_id && activeAccountIds.has(item.account_id) && item.movement_date?.slice(0, 10) < startKey)
      .reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * Number(item.amount), 0);
  const evolutionValues = [openingBalanceAtRange];
  let runningBalance = openingBalanceAtRange;
  chartData.forEach((bucket) => {
    const bucketMovements = periodMovements.filter((item) => {
      if (!item.account_id || !activeAccountIds.has(item.account_id)) return false;
      if (period === "daily") return item.movement_date?.slice(0, 10) === todayKey;
      if (period === "weekly") return item.movement_date?.slice(0, 10) === bucket.key;
      if (period === "monthly") return Math.floor((Number(item.movement_date.slice(8, 10)) - 1) / 7) === Number(bucket.key.slice(5)) - 1;
      return Number(item.movement_date.slice(5, 7)) === Number(bucket.key.slice(6));
    });
    runningBalance += bucketMovements.reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * Number(item.amount), 0);
    evolutionValues.push(runningBalance);
  });
  const evolutionMin = Math.min(...evolutionValues, 0);
  const evolutionMax = Math.max(...evolutionValues, 1);
  const evolutionRange = Math.max(1, evolutionMax - evolutionMin);
  const evolutionPoints = evolutionValues.map((value, index) => {
    const x = 8 + (index / Math.max(1, evolutionValues.length - 1)) * 284;
    const y = 88 - ((value - evolutionMin) / evolutionRange) * 72;
    return `${x},${y}`;
  }).join(" ");
  const comparisonMax = Math.max(1, income, expenses);

  if (loading) return <section className="card">Preparando tu panorama financiero...</section>;
  if (error) return <section className="card"><p>{error}</p><button className="text-button" onClick={() => { setLoading(true); void loadData(); }}>Reintentar</button></section>;

  return (
    <div className="dashboard-overview">
      <header className="dashboard-identity-compact" aria-label="FINANCETRACK">
        <MobileMenu />
        <p>Entendé qué está pasando con tu dinero.</p>
      </header>

      <section className="dashboard-balance-card dashboard-balance-compact">
        <div className="dashboard-balance-heading">
          <div>
            <p className="eyebrow">RESUMEN PERSONAL</p>
            <h2>Tu dinero, en perspectiva.</h2>
          </div>
          <label className="currency-picker">Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className="dashboard-balance-controls">
          <span>Período</span>
          <div className="dashboard-period-switch" role="group" aria-label="Filtrar dashboard por período">
            {([[ "daily", "Diario" ], [ "weekly", "Semanal" ], [ "monthly", "Mensual" ], [ "yearly", "Anual" ]] as const).map(([value, label]) => (
              <button key={value} type="button" className={period === value ? "active" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="dashboard-balance-main">
          <div>
            <p className="balance-kicker">BALANCE NETO REGISTRADO · {period === "daily" ? "HOY" : period === "weekly" ? "ESTA SEMANA" : period === "monthly" ? "ESTE MES" : "ESTE AÑO"}</p>
            <h1>{money(periodNet, currency)}</h1>
            <p className="balance-caption">{periodNet > 0 ? "Registraste más ingresos que gastos en este período." : periodNet < 0 ? "Tus gastos registrados superan tus ingresos en este período." : "Tus ingresos y gastos registrados están equilibrados en este período."}</p>
          </div>
          <div className="balance-period"><span>Balance acumulado</span><strong>{money(allTimeNet, currency)}</strong><small>Desde tus primeros movimientos</small></div>
        </div>
      </section>

      <section className="stats-grid dashboard-stat-cards">
        <article className="card stat-card income-stat-card"><p className="card-label">Ingresos {periodLabel}</p><h3 className="card-value">{money(income, currency)}</h3></article>
        <article className="card stat-card expense-stat-card"><p className="card-label">Gastos {periodLabel}</p><h3 className="card-value">{money(expenses, currency)}</h3></article>
        <article className="card stat-card movements-stat-card"><p className="card-label">Movimientos {periodLabel}</p><h3 className="card-value">{periodMovements.length}</h3></article>
      </section>

      <section className="card dashboard-recent-top">
        <div className="section-heading">
          <div><p className="eyebrow">ACTIVIDAD RECIENTE</p><h3>Últimos movimientos</h3></div>
          <span className="dashboard-section-note">Últimos 5 registros · {currency}</span>
        </div>
        {recent.length === 0 ? <p className="empty-state">Todavía no tenés movimientos registrados en {currency}.</p> : recent.map((item) => (
          <div className="recent-movement" key={item.id}>
            <span className={`movement-dot ${item.type === "income" ? "dot-income" : "dot-expense"}`} />
            <div className="recent-description"><strong>{item.description || item.category || "Movimiento"}</strong><small>{item.category || "Sin categoría"} · {shortDate(item.movement_date)}</small></div>
            <b className={item.type === "income" ? "amount-income" : "amount-expense"}>{item.type === "income" ? "+" : "−"}{money(Number(item.amount), currency)}</b>
          </div>
        ))}
      </section>

      <section className="dashboard-accounts-section dashboard-accounts-top">
        <div className="section-heading">
          <div><p className="eyebrow">PATRIMONIO POR CUENTAS</p><h3>Tu dinero disponible</h3></div>
          <strong>{money(accountTotal, currency)}</strong>
        </div>
        {activeAccounts.length === 0 ? <p className="empty-state">Todavía no tenés cuentas activas en {currency}. Podés agregarlas desde Mis cuentas.</p> : (
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

      <section className="vera-insight-card vera-insight-compact">
        <div className="vera-insight-top">
          <span className="vera-mark">V</span>
          <div><p className="eyebrow">VERA · LECTURA RÁPIDA</p><h3>{periodMovements.length === 0 ? "Todavía no hay datos para este período." : periodNet > 0 ? "Tu balance está en positivo." : periodNet < 0 ? "Tus gastos superan tus ingresos." : "Tu balance está equilibrado."}</h3></div>
          <span className="insight-status">Básico</span>
        </div>
        <p>{periodMovements.length === 0 ? "Cuando registres ingresos y gastos, voy a poder mostrarte una lectura basada en tus movimientos." : periodNet > 0 ? "En " + periodLabel + " registraste " + money(periodNet, currency) + " más en ingresos que en gastos." : periodNet < 0 ? "La diferencia entre ingresos y gastos " + periodLabel + " es de " + money(Math.abs(periodNet), currency) + "." : "Tus ingresos y gastos registrados " + periodLabel + " tienen el mismo total."}</p>
      </section>

      <section className="dashboard-charts-section">
        <div className="dashboard-charts-heading"><div><p className="eyebrow">ANÁLISIS FINANCIERO</p><h2>Tus números, en perspectiva</h2></div><span>{period === "daily" ? "Hoy" : period === "weekly" ? "Últimos 7 días" : period === "monthly" ? "Mes actual" : "Año actual"} · {currency}</span></div>

        <div className="dashboard-charts-grid">
          <section className="card dashboard-chart-card">
            <div className="section-heading"><div><p className="eyebrow">GASTOS</p><h3>Por categoría</h3></div></div>
            {categoryData.length === 0 ? <p className="empty-state">No hay gastos registrados para este período.</p> : <div className="dashboard-category-list">
              {categoryData.map((item, index) => <div className="dashboard-category-row" key={item.name}>
                <div className="dashboard-category-meta"><span><i className={`category-dot category-dot-${index % 5}`} />{item.name}</span><strong>{money(item.amount, currency)}</strong></div>
                <div className="dashboard-progress-track"><span className={`category-fill category-fill-${index % 5}`} style={{ width: (item.amount / maxCategory * 100) + "%" }} /></div>
                <small>{expenses > 0 ? Math.round(item.amount / expenses * 100) : 0}% de los gastos del período</small>
              </div>)}
            </div>}
          </section>

          <section className="card dashboard-chart-card">
            <div className="section-heading"><div><p className="eyebrow">PATRIMONIO</p><h3>Distribución por cuenta</h3></div></div>
            {activeAccounts.length === 0 ? <p className="empty-state">Agregá una cuenta para ver la distribución.</p> : <div className="dashboard-account-distribution">
              {activeAccounts.map((account, index) => {
                const balance = accountBalances[account.id] ?? 0;
                const share = accountPositiveTotal > 0 ? Math.max(0, balance) / accountPositiveTotal * 100 : 0;
                return <div className="dashboard-distribution-row" key={account.id}>
                  <div className="dashboard-category-meta"><span><i className={`category-dot category-dot-${index % 5}`} />{account.name}</span><strong>{money(balance, currency)}</strong></div>
                  <div className="dashboard-progress-track"><span className={`category-fill category-fill-${index % 5}`} style={{ width: share + "%" }} /></div>
                  <small>{share.toFixed(1)}% del saldo positivo en tus cuentas</small>
                </div>;
              })}
            </div>}
          </section>

          <section className="card dashboard-chart-card">
            <div className="section-heading"><div><p className="eyebrow">EVOLUCIÓN</p><h3>Balance a lo largo del tiempo</h3></div></div>
            {periodMovements.filter((item) => item.account_id && activeAccountIds.has(item.account_id)).length === 0
              ? <p className="empty-state">Cuando registres movimientos asociados a tus cuentas, vas a ver cómo evoluciona tu saldo.</p>
              : <div className="dashboard-evolution-chart">
                <div className="dashboard-evolution-value">{money(evolutionValues[evolutionValues.length - 1], currency)}</div>
                <svg viewBox="0 0 300 100" role="img" aria-label="Evolución del saldo de tus cuentas durante el período">
                  <line x1="8" y1="88" x2="292" y2="88" className="evolution-axis" />
                  <polyline points={evolutionPoints} className="evolution-line" />
                  {evolutionValues.map((value, index) => <circle key={index} cx={8 + (index / Math.max(1, evolutionValues.length - 1)) * 284} cy={88 - ((value - evolutionMin) / evolutionRange) * 72} r="2.8" className="evolution-point"><title>{money(value, currency)}</title></circle>)}
                </svg>
                <div className="dashboard-evolution-labels"><span>{period === "daily" ? "Inicio del día" : "Inicio del período"}</span><span>{period === "daily" ? "Hoy" : "Actual"}</span></div>
                <small>Saldo estimado de las cuentas activas; las transferencias entre ellas no alteran el total.</small>
              </div>}
          </section>

          <section className="card dashboard-chart-card">
            <div className="section-heading"><div><p className="eyebrow">COMPARACIÓN</p><h3>Ingresos vs. gastos</h3></div></div>
            <div className="dashboard-comparison">
              <div className="dashboard-comparison-row"><div><span>Ingresos</span><strong>{money(income, currency)}</strong></div><div className="dashboard-progress-track"><span className="comparison-income-fill" style={{ width: (income / comparisonMax * 100) + "%" }} /></div></div>
              <div className="dashboard-comparison-row"><div><span>Gastos</span><strong>{money(expenses, currency)}</strong></div><div className="dashboard-progress-track"><span className="comparison-expense-fill" style={{ width: (expenses / comparisonMax * 100) + "%" }} /></div></div>
              <div className="dashboard-comparison-result"><span>Resultado del período</span><strong className={periodNet >= 0 ? "amount-income" : "amount-expense"}>{periodNet > 0 ? "+" : periodNet < 0 ? "−" : ""}{money(Math.abs(periodNet), currency)}</strong></div>
            </div>
          </section>

          <section className="card dashboard-chart-card dashboard-timeline-card">
            <div className="section-heading"><div><p className="eyebrow">TENDENCIA</p><h3>Ingresos y gastos en el tiempo</h3></div><span className="chart-legend"><i className="legend-income" /> Ingresos <i className="legend-expense" /> Gastos</span></div>
            {periodMovements.length === 0 ? <p className="empty-state">No hay movimientos registrados {periodLabel}.</p> : <div className={`period-chart period-chart-${period}`}>{chartData.map((bucket) => <div className="period-column" key={bucket.key}><div className="period-bars"><span className="weekly-bar income-bar" style={{ height: Math.max(bucket.income / maxBucket * 100, bucket.income > 0 ? 5 : 0) + "%" }} title={"Ingresos: " + money(bucket.income, currency)} /><span className="weekly-bar expense-bar" style={{ height: Math.max(bucket.expenses / maxBucket * 100, bucket.expenses > 0 ? 5 : 0) + "%" }} title={"Gastos: " + money(bucket.expenses, currency)} /></div><span>{bucket.label}</span></div>)}</div>}
          </section>
        </div>
      </section>

      <p className="dashboard-disclaimer">Los importes se muestran por moneda y se basan únicamente en tus movimientos registrados. Las transferencias entre tus cuentas no se cuentan como ingresos ni gastos.</p>
    </div>
  );
}
