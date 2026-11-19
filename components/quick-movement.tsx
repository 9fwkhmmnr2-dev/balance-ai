"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";

const categories = ["Alimentación", "Transporte", "Vivienda", "Servicios", "Salud", "Educación", "Entretenimiento", "Trabajo", "Ventas", "Otros"];
const currencyOptions = [{ code: "ARS", label: "Pesos argentinos (ARS)" }, { code: "USD", label: "Dólares estadounidenses (USD)" }, { code: "EUR", label: "Euros (EUR)" }];

export default function QuickMovement() {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [category, setCategory] = useState("Otros");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const numericAmount = parseLocalizedAmount(amount);
    if (!description.trim() || numericAmount === null || numericAmount <= 0 || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || date > maxDate) {
      setMessage("Ingresá una descripción y un importe válido.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { error } = await supabase.from("movements").insert({
        user_id: user.id,
        description: description.trim(),
        type,
        amount: numericAmount,
        currency,
        category,
        movement_date: date
      });
      if (error) throw error;
      window.dispatchEvent(new Event("finance:movement-saved"));
      setDescription("");
      setAmount("");
      setCategory("Otros");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button id="registrar-movimiento" className="quick-add-button" onClick={() => { setMessage(""); setOpen(true); }}>
        <span aria-hidden="true">＋</span> Registrar movimiento
      </button>
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
                <label>Moneda<select value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
              </div>
              <div className="quick-form-row">
                <label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="quick-date-field">Fecha<input className="quick-date-input" type="date" max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              </div>
              {message && <p className="quick-modal-error" role="alert">{message}</p>}
              <button className="primary-button quick-modal-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar movimiento"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
