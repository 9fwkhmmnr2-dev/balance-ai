"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import MobileMenu from "./mobile-menu";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";

type Currency = "ARS" | "USD" | "EUR";
type Account = {
  id: string;
  name: string;
  currency: Currency;
  is_archived: boolean;
};

const currencyNames: Record<Currency, string> = {
  ARS: "Pesos argentinos",
  USD: "Dólares estadounidenses",
  EUR: "Euros"
};

function money(amount: number, currency: Currency) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export default function TransfersView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadAccounts() {
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { data, error: queryError } = await supabase
        .from("financial_accounts")
        .select("id, name, currency, is_archived")
        .eq("user_id", auth.user.id)
        .eq("is_archived", false)
        .order("name", { ascending: true });
      if (queryError) throw queryError;
      const rows = (data ?? []) as Account[];
      setAccounts(rows);
      setFromId((current) => rows.some((account) => account.id === current) ? current : rows[0]?.id ?? "");
      setToId((current) => rows.some((account) => account.id === current) ? current : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar tus cuentas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAccounts(); }, []);

  const fromAccount = accounts.find((account) => account.id === fromId);
  const matchingDestinations = useMemo(
    () => accounts.filter((account) => account.id !== fromId && account.currency === fromAccount?.currency),
    [accounts, fromId, fromAccount?.currency]
  );
  const toAccount = matchingDestinations.find((account) => account.id === toId);

  useEffect(() => {
    if (!matchingDestinations.some((account) => account.id === toId)) {
      setToId(matchingDestinations[0]?.id ?? "");
    }
  }, [matchingDestinations, toId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const parsedAmount = parseLocalizedAmount(amount);
    if (!fromAccount || !toAccount || parsedAmount === null || parsedAmount <= 0) {
      setError("Elegí las dos cuentas e ingresá un importe válido.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { error: transferError } = await supabase.rpc("create_account_transfer", {
        p_from_account_id: fromAccount.id,
        p_to_account_id: toAccount.id,
        p_amount: parsedAmount
      });
      if (transferError) throw transferError;
      setSuccess(`Transferencia registrada: ${money(parsedAmount, fromAccount.currency)} · Desde ${fromAccount.name} · Hacia ${toAccount.name}`);
      setAmount("");
      window.dispatchEvent(new Event("finance:transfer-saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar la transferencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="transfers-page">
      <MobileMenu />
      <nav className="transfers-desktop-nav">
        <a href="/" className="mobile-brand">FINANCE<span>.</span>AI</a>
        <div>
          <a href="/">Inicio</a>
          <a href="/movimientos">Movimientos</a>
          <a href="/cuentas">Mis cuentas</a>
          <a href="/transferencias" aria-current="page">Transferencias</a>
          <a href="/conversor">Conversor</a>
          <a href="/perfil">Perfil</a>
        </div>
      </nav>
      <main className="transfers-main">
        <header className="transfers-heading">
          <p className="eyebrow">ENTRE TUS CUENTAS</p>
          <h1>Transferencias</h1>
          <p>Pasá dinero de una cuenta propia a otra.</p>
        </header>

        {loading ? <section className="transfers-card">Cargando tus cuentas...</section> : accounts.length < 2 ? (
          <section className="transfers-card transfers-empty">
            <h2>Necesitás al menos dos cuentas activas</h2>
            <p>Agregá otra cuenta para poder registrar una transferencia.</p>
            <a className="transfers-primary-button" href="/cuentas">Ir a Mis cuentas</a>
          </section>
        ) : (
          <section className="transfers-card">
            <form onSubmit={handleSubmit}>
              <label>Desde
                <select value={fromId} onChange={(event) => setFromId(event.target.value)} required>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
                </select>
              </label>
              <label>Hacia
                <select value={toId} onChange={(event) => setToId(event.target.value)} required disabled={matchingDestinations.length === 0}>
                  {matchingDestinations.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
                </select>
              </label>
              <label>Importe
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Ej. 25.000" required />
                {fromAccount && <small>{currencyNames[fromAccount.currency]}</small>}
              </label>
              {matchingDestinations.length === 0 && <p className="transfers-error">No hay otra cuenta activa en la misma moneda.</p>}
              {error && <p className="transfers-error" role="alert">{error}</p>}
              {success && <p className="transfers-success" role="status">{success}</p>}
              <button className="transfers-primary-button" type="submit" disabled={saving || matchingDestinations.length === 0}>
                {saving ? "Registrando..." : "Confirmar transferencia"}
              </button>
            </form>
          </section>
        )}
        <p className="transfers-note">Esto registra un movimiento entre tus cuentas en FINANCETRACK. No envía dinero desde tu banco o billetera.</p>
      </main>
    </div>
  );
}
