"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import { supabase } from "../../lib/supabase";
import { parseLocalizedAmount } from "../../lib/parse-localized-amount";

type Movement = {
  id: string;
  user_id: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  movement_date: string;
  created_at?: string;
};

type Draft = {
  description: string;
  type: "income" | "expense";
  amount: string;
  currency: string;
  category: string;
  movement_date: string;
};

const categories = ["Alimentación", "Transporte", "Vivienda", "Servicios", "Salud", "Educación", "Entretenimiento", "Trabajo", "Ventas", "Otros"];
const supportedCurrencies = [{ code: "ARS", label: "Pesos argentinos (ARS)" }, { code: "USD", label: "Dólares estadounidenses (USD)" }, { code: "EUR", label: "Euros (EUR)" }];
function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const todayKey = localDateKey(new Date());
const emptyDraft: Draft = { description: "", type: "expense", amount: "", currency: "ARS", category: "Otros", movement_date: todayKey };

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return currency + " " + amount.toLocaleString("es-AR");
  }
}

function MovementsContent() {
  const [items, setItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [editing, setEditing] = useState<Movement | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadMovements = useCallback(async () => {
    setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError("No pudimos verificar tu sesión. Volvé a iniciar sesión.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("movements")
      .select("id, user_id, description, type, amount, currency, category, movement_date, created_at")
      .eq("user_id", auth.user.id)
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (queryError) {
      setError("No pudimos cargar tus movimientos. Intentá nuevamente.");
    } else {
      setItems((data ?? []) as Movement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const categoriesInData = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")), [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return items.filter((item) => {
      if (term && !item.description.toLocaleLowerCase("es").includes(term)) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      const itemDate = item.movement_date?.slice(0, 10) || "";
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (currencyFilter !== "all" && item.currency !== currencyFilter) return false;
      if (periodFilter === "today" && itemDate !== todayKey) return false;
      if (periodFilter === "7days") { const start = new Date(); start.setDate(start.getDate() - 6); if (itemDate < localDateKey(start) || itemDate > todayKey) return false; }
      if (periodFilter === "30days") { const start = new Date(); start.setDate(start.getDate() - 29); if (itemDate < localDateKey(start) || itemDate > todayKey) return false; }
      if (periodFilter === "thisMonth" && itemDate.slice(0, 7) !== todayKey.slice(0, 7)) return false;
      if (periodFilter === "lastMonth") { const previous = new Date(); previous.setDate(1); previous.setMonth(previous.getMonth() - 1); if (itemDate.slice(0, 7) !== localDateKey(previous).slice(0, 7)) return false; }
      if (periodFilter === "custom" && ((dateFrom && itemDate < dateFrom) || (dateTo && itemDate > dateTo))) return false;
      return true;
    }).sort((a, b) => {
      if (sortOrder === "oldest") return a.movement_date.localeCompare(b.movement_date) || (a.created_at || "").localeCompare(b.created_at || "");
      if (sortOrder === "amountHigh") return Number(b.amount) - Number(a.amount);
      if (sortOrder === "amountLow") return Number(a.amount) - Number(b.amount);
      return b.movement_date.localeCompare(a.movement_date) || (b.created_at || "").localeCompare(a.created_at || "");
    });
  }, [items, search, typeFilter, periodFilter, dateFrom, dateTo, categoryFilter, currencyFilter, sortOrder]);

  const totals = useMemo(() => {
    const result = new Map<string, { income: number; expense: number }>();
    filtered.forEach((item) => {
      const current = result.get(item.currency) ?? { income: 0, expense: 0 };
      current[item.type] += Number(item.amount);
      result.set(item.currency, current);
    });
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function startEditing(item: Movement) {
    setNotice("");
    setEditing(item);
    setDraft({
      description: item.description,
      type: item.type,
      amount: String(item.amount).replace(".", ","),
      currency: item.currency,
      category: item.category || "Otros",
      movement_date: item.movement_date
    });
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const amount = parseLocalizedAmount(draft.amount);
    if (!draft.description.trim() || amount === null || amount <= 0 || !isValidDateKey(draft.movement_date) || draft.movement_date > todayKey || !supportedCurrencies.some((currency) => currency.code === draft.currency)) {
      setNotice("Revisá la descripción, el importe y la fecha.");
      return;
    }
    setSaving(true);
    setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setNotice("Tu sesión venció. Volvé a iniciar sesión.");
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.from("movements").update({
      description: draft.description.trim(),
      type: draft.type,
      amount,
      currency: draft.currency,
      category: draft.category,
      movement_date: draft.movement_date
    }).eq("id", editing.id).eq("user_id", auth.user.id);
    if (updateError) {
      setNotice("No pudimos actualizar el movimiento. Intentá nuevamente.");
    } else {
      setEditing(null);
      await loadMovements();
      window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice("Movimiento actualizado.");
    }
    setSaving(false);
  }

  async function deleteMovement(item: Movement) {
    const confirmed = window.confirm(`¿Querés eliminar “${item.description}”? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setNotice("Tu sesión venció. Volvé a iniciar sesión.");
      return;
    }
    const { error: deleteError } = await supabase.from("movements").delete().eq("id", item.id).eq("user_id", auth.user.id);
    if (deleteError) {
      setNotice("No pudimos eliminar el movimiento. Intentá nuevamente.");
    } else {
      setItems((current) => current.filter((row) => row.id !== item.id));
      window.dispatchEvent(new Event("finance:movement-saved"));
      setNotice("Movimiento eliminado.");
    }
  }

  return (
    <div className="movements-page">
      <MobileMenu />
      <header className="movements-desktop-nav">
        <a href="/" className="mobile-brand">FINANCE<span>.</span>AI</a>
        <nav><a href="/">Inicio</a><a href="/movimientos" aria-current="page">Movimientos</a><a href="/cuentas">Mis cuentas</a><a href="/transferencias">Transferencias</a><a href="/conversor">Conversor</a><a href="/perfil">Perfil</a></nav>
      </header>
      <main className="movements-main">
        <div className="movements-heading">
          <div><p className="eyebrow">TU ACTIVIDAD FINANCIERA</p><h1>Movimientos</h1><p>Todo lo que registraste, en un solo lugar.</p></div>
          <a className="movements-add-link" href="/">Registrar movimiento</a>
        </div>

        <section className="movements-summary" aria-label="Resumen de movimientos filtrados">
          <div className="movements-summary-top"><div><p className="eyebrow">RESUMEN DEL FILTRO</p><h2>{filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}</h2></div><span>Los totales se separan por moneda</span></div>
          {totals.length === 0 ? <p className="movements-empty-summary">No hay importes para mostrar con estos filtros.</p> : <div className="movements-total-grid">{totals.map(([currency, values]) => <div className="movements-total-currency" key={currency}><span>{currency}</span><div><small>Ingresos</small><strong className="amount-income">{formatMoney(values.income, currency)}</strong></div><div><small>Gastos</small><strong className="amount-expense">{formatMoney(values.expense, currency)}</strong></div><div><small>Diferencia</small><strong>{formatMoney(values.income - values.expense, currency)}</strong></div></div>)}</div>}
        </section>

        <section className="movements-filters" aria-label="Filtros">
          <label className="movements-search">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descripción del movimiento" /></label>
          <label>Tipo<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select></label>
          <label>Período<select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option value="all">Todo el historial</option><option value="today">Hoy</option><option value="7days">Últimos 7 días</option><option value="30days">Últimos 30 días</option><option value="thisMonth">Este mes</option><option value="lastMonth">Mes anterior</option><option value="custom">Fechas personalizadas</option></select></label>
          {periodFilter === "custom" && <><label>Desde<input type="date" max={todayKey} value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); if (dateTo && event.target.value > dateTo) setDateTo(""); }} /></label><label>Hasta<input type="date" min={dateFrom || undefined} max={todayKey} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></>}
          <label>Categoría<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas</option>{categoriesInData.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Moneda<select value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); if (event.target.value === "all" && (sortOrder === "amountHigh" || sortOrder === "amountLow")) setSortOrder("newest"); }}><option value="all">Todas las monedas</option>{supportedCurrencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}</select></label>
          <label>Ordenar<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="amountHigh" disabled={currencyFilter === "all"}>Importe mayor (elegí una moneda)</option><option value="amountLow" disabled={currencyFilter === "all"}>Importe menor (elegí una moneda)</option></select></label>
          <button type="button" className="movements-clear-filters" onClick={() => { setSearch(""); setTypeFilter("all"); setPeriodFilter("all"); setDateFrom(""); setDateTo(""); setCategoryFilter("all"); setCurrencyFilter("all"); setSortOrder("newest"); }}>Limpiar filtros</button>
        </section>

        {notice && <p className="movements-notice" role="status">{notice}</p>}
        {error ? <section className="movements-list-card"><p className="movements-error">{error}</p><button className="movements-clear-filters" onClick={() => { setLoading(true); void loadMovements(); }}>Reintentar</button></section> : loading ? <section className="movements-list-card"><p className="movements-empty">Cargando tus movimientos...</p></section> : filtered.length === 0 ? <section className="movements-list-card"><h2>No encontramos movimientos</h2><p className="movements-empty">{items.length === 0 ? "Cuando registres un ingreso o gasto, aparecerá acá." : "Probá cambiar los filtros para ver otros registros."}</p></section> : <section className="movements-list-card"><div className="movements-list-heading"><h2>Historial</h2><span>{filtered.length} registros</span></div>{filtered.map((item) => <article className="movements-row" key={item.id}><span className={`movements-type-mark ${item.type === "income" ? "income" : "expense"}`} aria-hidden="true" /><div className="movements-row-info"><strong>{item.description}</strong><span>{item.category} · {new Date(item.movement_date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</span></div><strong className={item.type === "income" ? "amount-income" : "amount-expense"}>{item.type === "income" ? "+" : "−"}{formatMoney(Number(item.amount), item.currency)}</strong><div className="movements-row-actions"><button type="button" onClick={() => startEditing(item)}>Editar</button><button type="button" onClick={() => void deleteMovement(item)}>Eliminar</button></div></article>)}</section>}
      </main>

      {editing && <div className="movement-edit-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}><section className="movement-edit-modal" role="dialog" aria-modal="true" aria-labelledby="movement-edit-title"><div className="movement-edit-heading"><div><p className="eyebrow">ACTUALIZAR REGISTRO</p><h2 id="movement-edit-title">Editar movimiento</h2></div><button type="button" onClick={() => setEditing(null)} disabled={saving} aria-label="Cerrar">×</button></div><form onSubmit={saveEdit}><label>Descripción<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={100} required /></label><div className="movement-edit-grid"><label>Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Draft["type"] })}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label>Importe<input inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} required /></label><label>Moneda<select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}>{supportedCurrencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}{!supportedCurrencies.some((currency) => currency.code === draft.currency) && <option value={draft.currency}>{draft.currency}</option>}</select></label><label>Categoría<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{Array.from(new Set([...categories, draft.category])).map((category) => <option key={category}>{category}</option>)}</select></label><label className="movement-edit-date">Fecha<input type="date" max={todayKey} value={draft.movement_date} onChange={(event) => setDraft({ ...draft, movement_date: event.target.value })} required /></label></div>{notice && <p className="movements-error" role="alert">{notice}</p>}<button className="movements-save-button" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></form></section></div>}
    </div>
  );
}

export default function MovementsPage() {
  return <AuthGuard><OnboardingGate><MovementsContent /></OnboardingGate></AuthGuard>;
}
