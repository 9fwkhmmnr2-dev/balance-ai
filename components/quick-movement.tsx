"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";
import CurrencyPicker from "./currency-picker";
import { useProfileCurrency } from "../lib/use-profile-currency";

const categories = ["Alimentación", "Transporte", "Vivienda", "Servicios", "Salud", "Educación", "Entretenimiento", "Trabajo", "Ventas", "Otros"];
type AccountOption = { id: string; name: string; currency: string };
type GoalOption = { id: string; title: string; currency: string; status: string };

export default function QuickMovement({ showButton = true }: { showButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [compactButton, setCompactButton] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCompactButton(true), 2700);
    return () => window.clearTimeout(timeout);
  }, []);
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const profileCurrency = useProfileCurrency();
  useEffect(() => { setCurrency(profileCurrency); }, [profileCurrency]);
  const [category, setCategory] = useState("Otros");
  const [accountId, setAccountId] = useState("");
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [goalId, setGoalId] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const matchingAccounts = accounts.filter((account) => account.currency === currency);

  const openModal = useCallback(async () => {
    setMessage("");
    setOpen(true);
    setLoadingAccounts(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { data, error } = await supabase.from("financial_accounts").select("id, name, currency").eq("user_id", auth.user.id).eq("is_archived", false).order("created_at", { ascending: true });
      if (error) throw error;
      const available = (data ?? []) as AccountOption[];
      setAccounts(available);
      setAccountId(available.find((account) => account.currency === currency)?.id ?? "");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const goalsResponse = await fetch("/api/financial-goals", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (goalsResponse.ok) {
          const goalsPayload = await goalsResponse.json();
          setGoals((goalsPayload.goals ?? []).filter((goal: GoalOption) => goal.status === "active"));
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos cargar tus cuentas.");
    } finally {
      setLoadingAccounts(false);
    }
  }, [currency]);

  useEffect(() => {
    const openFromMovementsPage = () => { void openModal(); };
    window.addEventListener("finance:open-quick-movement", openFromMovementsPage);
    return () => window.removeEventListener("finance:open-quick-movement", openFromMovementsPage);
  }, [openModal]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const numericAmount = parseLocalizedAmount(amount);
    if (!description.trim() || numericAmount === null || numericAmount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > maxDate) {
      setMessage("Completá la descripción, ingresá un importe válido y elegí una fecha que no sea futura.");
      return;
    }
    const selectedAccount = accounts.find((account) => account.id === accountId && account.currency === currency);
    if (!selectedAccount) {
      setMessage("Elegí una cuenta activa que use la misma moneda del movimiento.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      if (goalId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
        const response = await fetch("/api/financial-goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "movement", goalId, type, amount: numericAmount, currency, category, description: description.trim(), movementDate: date, accountId: selectedAccount.id })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No pudimos vincular el movimiento con el objetivo.");
      } else {
        const { error } = await supabase.from("movements").insert({
          user_id: user.id,
          description: description.trim(),
          type,
          amount: numericAmount,
          currency,
          category,
          movement_date: date,
          account_id: selectedAccount.id
        });
        if (error) throw error;
      }
      window.dispatchEvent(new Event("finance:movement-saved"));
      setDescription("");
      setAmount("");
      setCategory("Otros");
      setGoalId("");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {showButton && <button id="registrar-movimiento" className={`quick-add-button${compactButton ? " is-compact" : ""}`} aria-label="Registrar movimiento" title="Registrar movimiento" onClick={() => void openModal()}>
        <span className="quick-add-icon" aria-hidden="true">＋</span><span className="quick-add-label">Registrar movimiento</span>
      </button>}
      {open && (
        <div className="quick-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setOpen(false);
        }}>
          <section className="quick-modal" role="dialog" aria-modal="true" aria-labelledby="quick-modal-title">
            <div className="quick-modal-heading">
              <div>
                <p className="eyebrow">NUEVO REGISTRO</p>
                <h2 id="quick-modal-title">Registrar movimiento</h2>
              </div>
              <button className="quick-modal-close" onClick={() => setOpen(false)} disabled={saving} aria-label="Cerrar">×</button>
            </div>
            <div className="movement-type-switch">
              <button type="button" className={type === "expense" ? "selected" : ""} onClick={() => setType("expense")}>Gasto</button>
              <button type="button" className={type === "income" ? "selected" : ""} onClick={() => setType("income")}>Ingreso</button>
            </div>
            <form className="quick-modal-form" onSubmit={handleSubmit}>
              <label>Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Supermercado" maxLength={100} required /></label>
              <div className="quick-form-row">
                <label>Importe<input type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej. 160.000,50" required /></label>
                <label>Moneda<CurrencyPicker value={currency} onChange={(next) => { setCurrency(next); setAccountId(accounts.find((account) => account.currency === next)?.id ?? ""); }} label="Moneda del movimiento" variant="dark" /></label>
              </div>
              <label>Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loadingAccounts || matchingAccounts.length === 0}><option value="">{loadingAccounts ? "Cargando cuentas..." : matchingAccounts.length ? "Seleccionar cuenta" : "No hay cuentas en esta moneda"}</option>{matchingAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label>Vincular a un objetivo (opcional)<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">Sin objetivo</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} · {goal.currency}</option>)}</select></label>
              {goalId && goals.find((goal) => goal.id === goalId)?.currency !== currency && <p className="quick-modal-error">El importe se convertirá de {currency} a {goals.find((goal) => goal.id === goalId)?.currency} usando la cotización disponible al registrar.</p>}

              {matchingAccounts.length === 0 && !loadingAccounts && <p className="quick-modal-error">Necesitás una cuenta activa en {currency} para registrar este movimiento. <a href="/cuentas">Crear una cuenta</a>.</p>}
              <div className="quick-form-row">
                <label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="quick-date-field">Fecha<input className="quick-date-input" type="date" max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              </div>
              {message && <p className="quick-modal-error" role="alert">{message}</p>}
              <button className="primary-button quick-modal-submit" type="submit" disabled={saving || loadingAccounts || matchingAccounts.length === 0}>{saving ? "Guardando..." : "Guardar movimiento"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
