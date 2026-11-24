
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";
import CurrencyPicker from "./currency-picker";
import { useProfileCurrency } from "../lib/use-profile-currency";

type Movement = {
  id: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  movement_date: string;
};

export default function MovementsManager() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Otros");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [currency, setCurrency] = useState("ARS");
  const profileCurrency = useProfileCurrency();
  useEffect(() => { setCurrency(profileCurrency); }, [profileCurrency]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadMovements() {
    const { data, error } = await supabase
      .from("movements")
      .select("id, description, type, amount, currency, category, movement_date")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("No pudimos cargar los movimientos.");
      return;
    }

    setMovements((data ?? []) as Movement[]);
  }

  useEffect(() => {
    void loadMovements();
    const refresh = () => { void loadMovements(); };
    window.addEventListener("finance:movement-saved", refresh);
    return () => window.removeEventListener("finance:movement-saved", refresh);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const numericAmount = parseLocalizedAmount(amount);

    if (!description.trim() || numericAmount === null || numericAmount <= 0) {
      setMessage("Completá la descripción y un importe válido.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      }

      const { error } = await supabase.from("movements").insert({
        user_id: user.id,
        description: description.trim(),
        type,
        amount: numericAmount,
        currency,
        category
      });

      if (error) throw error;

      setDescription("");
      setAmount("");
      setCategory("Otros");
      setType("expense");

      await loadMovements();
      setMessage("Movimiento guardado correctamente.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No pudimos guardar el movimiento."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatAmount(movement: Movement) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: movement.currency
    }).format(movement.amount);
  }

  return (
    <section className="card" style={{ marginTop: 22 }}>
      <h2 className="section-title">Registrar movimiento</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descripción (ej. Supermercado)"
          required
          maxLength={100}
        />

        <select
          value={type}
          onChange={(event) => setType(event.target.value as "income" | "expense")}
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>

        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Ej. 160.000,50"
          required
        />

        <CurrencyPicker value={currency} onChange={setCurrency} label="Moneda del movimiento" variant="light" />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>Otros</option>
          <option>Alimentación</option>
          <option>Transporte</option>
          <option>Vivienda</option>
          <option>Servicios</option>
          <option>Salud</option>
          <option>Educación</option>
          <option>Entretenimiento</option>
          <option>Trabajo</option>
          <option>Ventas</option>
        </select>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar movimiento"}
        </button>
      </form>

      {message && (
        <p role="status" style={{ marginTop: 12, fontSize: 13 }}>
          {message}
        </p>
      )}

      <h2 className="section-title" style={{ marginTop: 28 }}>
        Movimientos recientes
      </h2>

      {movements.length === 0 ? (
        <p style={{ color: "#78716C", fontSize: 13 }}>
          Todavía no registraste movimientos.
        </p>
      ) : (
        movements.map((movement) => (
          <div className="movement" key={movement.id}>
            <div>
              <p className="movement-name">{movement.description}</p>
              <p className="movement-detail">
                {movement.category} · {movement.movement_date}
              </p>
            </div>

            <span className="movement-amount">
              {movement.type === "income" ? "+" : "−"}
              {formatAmount(movement)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
