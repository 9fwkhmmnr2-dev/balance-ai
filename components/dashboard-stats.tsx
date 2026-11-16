
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Movement = {
  type: "income" | "expense";
  amount: number;
  currency: string;
  movement_date: string;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardStats() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currency, setCurrency] = useState("ARS");
  const [currencies, setCurrencies] = useState(["ARS"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData.user) {
          throw new Error("No pudimos verificar tu sesión.");
        }

        const { data: profile, error: profileError } = await supabase
          .from("financial_profiles")
          .select("currency")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const preferredCurrency = profile?.currency || "ARS";
        setCurrency(preferredCurrency);

        const { data, error: movementsError } = await supabase
          .from("movements")
          .select("type, amount, currency, movement_date")
          .order("movement_date", { ascending: false });

        if (movementsError) throw movementsError;

        const records = (data ?? []) as Movement[];
        setMovements(records);

        setCurrencies(
          Array.from(
            new Set([
              preferredCurrency,
              ...records.map((item) => item.currency)
            ])
          )
        );
      } catch {
        setError("No pudimos cargar tus estadísticas. Intentá recargar.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <section className="card">Calculando tus estadísticas...</section>;
  }

  if (error) {
    return <section className="card">{error}</section>;
  }

  const selectedMovements = movements.filter(
    (item) => item.currency === currency
  );

  const today = new Date();
  const currentMonth = localDateKey(
    new Date(today.getFullYear(), today.getMonth(), 1)
  ).slice(0, 7);

  const monthlyMovements = selectedMovements.filter(
    (item) => item.movement_date.slice(0, 7) === currentMonth
  );

  const totalIncome = monthlyMovements
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalExpenses = monthlyMovements
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const netBalance = selectedMovements.reduce(
    (sum, item) =>
      sum + (item.type === "income" ? 1 : -1) * Number(item.amount),
    0
  );

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);

    const amount = selectedMovements
      .filter((item) => item.movement_date.slice(0, 10) === key)
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      day: date.toLocaleDateString("es-AR", { weekday: "short" }),
      amount
    };
  });

  const maxActivity = Math.max(
    ...weeklyActivity.map((item) => item.amount),
    1
  );

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="dashboard-currency">Moneda de visualización</label>
        <select
          id="dashboard-currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          style={{ display: "block", marginTop: 8, padding: 10 }}
        >
          {currencies.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <section className="stats-grid">
        <article className="card">
          <p className="card-label">Balance neto registrado</p>
          <h2 className="card-value">{formatAmount(netBalance)}</h2>
          <p className="card-note">Ingresos menos gastos registrados</p>
        </article>

        <article className="card">
          <p className="card-label">Ingresos del mes</p>
          <h2 className="card-value">{formatAmount(totalIncome)}</h2>
          <p className="card-note">Ingresos registrados este mes</p>
        </article>

        <article className="card">
          <p className="card-label">Gastos del mes</p>
          <h2 className="card-value">{formatAmount(totalExpenses)}</h2>
          <p className="card-note">Gastos registrados este mes</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 22 }}>
        <h2 className="section-title">Actividad de los últimos 7 días</h2>

        {weeklyActivity.every((item) => item.amount === 0) ? (
          <p style={{ color: "#78716C", fontSize: 13 }}>
            Todavía no hay movimientos en estos días.
          </p>
        ) : (
          <div className="chart">
            {weeklyActivity.map((item) => (
              <div className="chart-column" key={item.day}>
                <div
                  className="chart-bar"
                  style={{
                    height: `${Math.max(
                      (item.amount / maxActivity) * 100,
                      item.amount > 0 ? 4 : 0
                    )}%`
                  }}
                  title={formatAmount(item.amount)}
                />
                <span className="chart-label">{item.day}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ color: "#A8A29E", fontSize: 11, marginTop: 10 }}>
        El balance neto no incluye saldos iniciales ni cuentas externas.
      </p>
    </>
  );
}
