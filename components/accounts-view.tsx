"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import MobileMenu from "./mobile-menu";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";
import CurrencyPicker from "./currency-picker";
import { useProfileCurrency } from "../lib/use-profile-currency";

type AccountType = "cash" | "wallet" | "bank" | "savings" | "other";
type Currency = string;
type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  initial_balance: number;
  is_archived: boolean;
  created_at: string;
};
type Movement = { account_id: string | null; type: "income" | "expense"; amount: number; currency: string };
type Transfer = { from_account_id: string; to_account_id: string; amount: number };

const accountTypes: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "wallet", label: "Billetera virtual" },
  { value: "bank", label: "Cuenta bancaria" },
  { value: "savings", label: "Ahorros" },
  { value: "other", label: "Otra cuenta" }
];

const typeLabel = (type: AccountType) => accountTypes.find((item) => item.value === type)?.label ?? "Cuenta";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return currency + " " + value.toLocaleString("es-AR");
  }
}

export default function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("wallet");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const profileCurrency = useProfileCurrency();
  useEffect(() => { setCurrency(profileCurrency); }, [profileCurrency]);
  const [initialBalance, setInitialBalance] = useState("0");

  const loadAccounts = useCallback(async () => {
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

      const [{ data: accountRows, error: accountError }, { data: movementRows, error: movementError }, { data: transferRows, error: transferError }] = await Promise.all([
        supabase.from("financial_accounts").select("id, name, type, currency, initial_balance, is_archived, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: true }),
        supabase.from("movements").select("account_id, type, amount, currency").eq("user_id", auth.user.id).not("account_id", "is", null),
        supabase.from("account_transfers").select("from_account_id, to_account_id, amount").eq("user_id", auth.user.id)
      ]);
      if (accountError) {
        if (accountError.message.toLowerCase().includes("financial_accounts") || accountError.code === "42P01") {
          throw new Error("La base de datos todavía no tiene habilitada la sección Mis cuentas. Primero hay que aplicar la migración SQL del proyecto.");
        }
        throw accountError;
      }
      if (movementError) throw movementError;
      if (transferError) throw transferError;
      setAccounts((accountRows ?? []) as Account[]);
      setMovements((movementRows ?? []) as Movement[]);
      setTransfers((transferRows ?? []) as Transfer[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar tus cuentas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    const refresh = () => { void loadAccounts(); };
    window.addEventListener("finance:transfer-saved", refresh);
    window.addEventListener("finance:movement-saved", refresh);
    return () => {
      window.removeEventListener("finance:transfer-saved", refresh);
      window.removeEventListener("finance:movement-saved", refresh);
    };
  }, [loadAccounts]);

  const balances = useMemo(() => {
    const result: Record<string, number> = {};
    accounts.forEach((account) => { result[account.id] = Number(account.initial_balance); });
    movements.forEach((movement) => {
      if (!movement.account_id || result[movement.account_id] === undefined) return;
      result[movement.account_id] += (movement.type === "income" ? 1 : -1) * Number(movement.amount);
    });
    transfers.forEach((transfer) => {
      if (result[transfer.from_account_id] !== undefined) result[transfer.from_account_id] -= Number(transfer.amount);
      if (result[transfer.to_account_id] !== undefined) result[transfer.to_account_id] += Number(transfer.amount);
    });
    return result;
  }, [accounts, movements, transfers]);

  const activeAccounts = accounts.filter((account) => !account.is_archived);
  const visibleAccounts = accounts.filter((account) => showArchived || !account.is_archived);
  const totals = useMemo(() => {
    const values: Record<string, number> = {};
    activeAccounts.forEach((account) => { values[account.currency] = (values[account.currency] ?? 0) + (balances[account.id] ?? 0); });
    return Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  }, [activeAccounts, balances]);

  function resetForm() {
    setName("");
    setType("wallet");
    setCurrency("ARS");
    setInitialBalance("0");
    setNotice("");
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const parsedBalance = parseLocalizedAmount(initialBalance);
    if (!name.trim() || name.trim().length > 50 || parsedBalance === null) {
      setNotice("Revisá el nombre y el saldo inicial.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { error: insertError } = await supabase.from("financial_accounts").insert({
        user_id: auth.user.id,
        name: name.trim(),
        type,
        currency,
        initial_balance: parsedBalance
      });
      if (insertError) throw insertError;
      setModalOpen(false);
      resetForm();
      await loadAccounts();
    } catch (err) {
      const databaseError = err && typeof err === "object"
        ? err as { code?: string; message?: string }
        : null;
      const message = databaseError?.message ?? "";
      if (databaseError?.code === "23514" && message.includes("financial_accounts_currency_check")) {
        setNotice("La moneda elegida todavía no está habilitada en la base de datos. Aplicá la migración de monedas y volvé a intentarlo.");
      } else if (databaseError?.code === "42501" || /row-level security|permission denied/i.test(message)) {
        setNotice("No se pudo guardar por los permisos de esta sesión. Verificá que hayas aceptado los Términos y la Política de Privacidad vigentes y volvé a iniciar sesión.");
      } else if (databaseError?.code === "23514") {
        setNotice("Revisá el nombre, el tipo de cuenta y la moneda seleccionada.");
      } else {
        setNotice("No pudimos guardar la cuenta. Revisá los datos e intentá nuevamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function archiveAccount(account: Account) {
    if (!window.confirm(`¿Querés archivar “${account.name}”? Va a dejar de aparecer entre tus cuentas activas, pero se conservará su historial.`)) return;
    setNotice("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotice("Tu sesión venció. Volvé a iniciar sesión."); return; }
    const { error: updateError } = await supabase.from("financial_accounts").update({ is_archived: true, updated_at: new Date().toISOString() }).eq("id", account.id).eq("user_id", auth.user.id);
    if (updateError) setNotice("No pudimos archivar la cuenta. Intentá nuevamente.");
    else await loadAccounts();
  }

  async function restoreAccount(account: Account) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotice("Tu sesión venció. Volvé a iniciar sesión."); return; }
    const { error: updateError } = await supabase.from("financial_accounts").update({ is_archived: false, updated_at: new Date().toISOString() }).eq("id", account.id).eq("user_id", auth.user.id);
    if (updateError) setNotice("No pudimos restaurar la cuenta. Intentá nuevamente.");
    else await loadAccounts();
  }

  async function deleteAccount(account: Account) {
    setNotice("");
    setDeletingId(account.id);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

      const { count, error: countError } = await supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("account_id", account.id);
      if (countError) throw countError;

      const { count: transferCount, error: transferCountError } = await supabase
        .from("account_transfers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .or(`from_account_id.eq.${account.id},to_account_id.eq.${account.id}`);
      if (transferCountError) throw transferCountError;
      if (transferCount) throw new Error("No podés eliminar una cuenta que tiene transferencias registradas. Podés archivarla.");

      const historyMessage = count
        ? ` Los ${count} movimientos asociados se conservarán, pero dejarán de estar vinculados a esta cuenta.`
        : " Esta cuenta no tiene movimientos asociados.";
      if (!window.confirm(`¿Eliminar definitivamente la cuenta “${account.name}”? Esta acción no se puede deshacer.${historyMessage}`)) return;

      const { error: deleteError } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", account.id)
        .eq("user_id", auth.user.id);
      if (deleteError) throw deleteError;

      await loadAccounts();
      setNotice("Cuenta eliminada. El historial de movimientos se conservó.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No pudimos eliminar la cuenta. Intentá nuevamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="accounts-page">
      <MobileMenu />
      <nav className="accounts-desktop-nav"><a href="/" className="mobile-brand">FINANCE<span>.</span>TRACK</a><div><a href="/">Inicio</a><a href="/movimientos">Movimientos</a><a href="/cuentas" aria-current="page">Mis cuentas</a><a href="/transferencias">Transferencias</a><a href="/conversor">Conversor</a><a href="/perfil">Perfil</a></div></nav>
      <header className="accounts-heading">
        <div><p className="eyebrow">ORGANIZÁ TU DINERO</p><h1>Mis cuentas</h1><p>Reuní tus saldos y conocé dónde está tu dinero.</p></div>
        <button className="accounts-add-button" onClick={() => { resetForm(); setModalOpen(true); }}>＋ Agregar cuenta</button>
      </header>

      {error ? <section className="accounts-empty"><h2>No pudimos abrir tus cuentas</h2><p>{error}</p><button className="accounts-secondary-button" onClick={() => { setLoading(true); void loadAccounts(); }}>Reintentar</button></section> : loading ? <section className="accounts-empty">Cargando tus cuentas...</section> : <>
        <section className="accounts-total-section">
          <div><p className="eyebrow">SALDOS POR MONEDA</p><h2>Tu dinero disponible</h2></div>
          {totals.length === 0 ? <p className="accounts-muted">Todavía no agregaste cuentas.</p> : <div className="accounts-total-grid">{totals.map(([code, value]) => <article className="accounts-total-card" key={code}><span>{code}</span><strong>{money(value, code)}</strong></article>)}</div>}
        </section>

        <div className="accounts-list-heading"><div><p className="eyebrow">TU ORGANIZACIÓN</p><h2>{showArchived ? "Todas las cuentas" : "Cuentas activas"}</h2></div><button className="accounts-text-button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Ocultar archivadas" : "Ver archivadas"}</button></div>

        {visibleAccounts.length === 0 ? <section className="accounts-empty"><h3>{showArchived ? "No hay cuentas para mostrar" : "Todavía no tenés cuentas"}</h3><p>Agregá efectivo, una billetera virtual, una cuenta bancaria o tus ahorros para empezar a organizar tus saldos.</p><button className="accounts-add-button" onClick={() => { resetForm(); setModalOpen(true); }}>Agregar primera cuenta</button></section> : <div className="accounts-grid">{visibleAccounts.map((account) => <article className={`account-card ${account.is_archived ? "archived" : ""}`} key={account.id}><div className="account-card-top"><span className="account-type-icon" aria-hidden="true">{account.type === "cash" ? "＄" : account.type === "wallet" ? "▣" : account.type === "bank" ? "⌂" : account.type === "savings" ? "◈" : "＋"}</span><span className="account-type-label">{typeLabel(account.type)}</span></div><h3>{account.name}</h3><p className="account-balance-label">Saldo actual</p><strong className="account-balance">{money(balances[account.id] ?? Number(account.initial_balance), account.currency)}</strong><div className="account-card-bottom">{account.is_archived ? <><span>Archivada</span><button onClick={() => void restoreAccount(account)}>Restaurar</button><button className="account-delete-button" disabled={deletingId === account.id} onClick={() => void deleteAccount(account)}>{deletingId === account.id ? "Eliminando..." : "Eliminar"}</button></> : <><span>{account.currency}</span><button onClick={() => void archiveAccount(account)}>Archivar</button><button className="account-delete-button" disabled={deletingId === account.id} onClick={() => void deleteAccount(account)}>{deletingId === account.id ? "Eliminando..." : "Eliminar"}</button></>}</div></article>)}</div>}
      </>}

      {notice && <p className="accounts-notice" role="status">{notice}</p>}

      {modalOpen && <div className="accounts-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}><section className="accounts-modal" role="dialog" aria-modal="true" aria-labelledby="accounts-modal-title"><div className="accounts-modal-heading"><div><p className="eyebrow">NUEVA CUENTA</p><h2 id="accounts-modal-title">Agregar cuenta</h2></div><button onClick={() => setModalOpen(false)} disabled={saving} aria-label="Cerrar">×</button></div><form onSubmit={createAccount}><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Mercado Pago" maxLength={50} required /></label><label>Tipo<select value={type} onChange={(event) => setType(event.target.value as AccountType)}>{accountTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Moneda<CurrencyPicker value={currency} onChange={setCurrency} label="Moneda de la cuenta" /></label><label>Saldo inicial<input value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} inputMode="decimal" placeholder="Ej. 150.000,00" required /><small>Es el saldo que tenés hoy al comenzar a usar esta cuenta en FINANCETRACK.</small></label>{notice && <p className="accounts-notice" role="alert">{notice}</p>}<button className="accounts-add-button accounts-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear cuenta"}</button></form></section></div>}
    </div>
  );
}
