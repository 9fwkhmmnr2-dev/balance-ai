
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  pay_frequency: string;
  typical_income: number | null;
  currency: string;
  next_pay_date: string | null;
  income_sources: string[];
  expense_categories: string[];
};

type Movement = {
  type: "income" | "expense";
  amount: number;
  currency: string;
  movement_date: string;
};

const frequencies: Record<string, string> = {
  monthly: "Mensualmente",
  biweekly: "Quincenalmente",
  weekly: "Semanalmente",
  daily: "Por día o trabajo",
  variable: "Variable",
  none: "Sin ingresos actualmente",
  not_set: "No configurada"
};

export default function ProfileView() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currency, setCurrency] = useState("ARS");
  const [currencies, setCurrencies] = useState<string[]>(["ARS"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData.user) {
          throw new Error("No pudimos verificar tu sesión.");
        }

        setEmail(userData.user.email ?? "");

        const { data: profileData, error: profileError } =
          await supabase
            .from("financial_profiles")
            .select("*")
            .eq("user_id", userData.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        setProfile(profileData);

        const preferredCurrency = profileData?.currency || "ARS";
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
        setError("No pudimos cargar tu perfil. Intentá nuevamente.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <section className="card">Cargando tu perfil...</section>;
  }

  if (error) {
    return <section className="card">{error}</section>;
  }

  const records = movements.filter(
    (item) => item.currency === currency
  );

  const now = new Date();
  const month = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const monthly = records.filter(
    (item) => item.movement_date.slice(0, 7) === month
  );

  const income = monthly
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = monthly
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = records.reduce(
    (sum, item) =>
      sum + (item.type === "income" ? 1 : -1) * Number(item.amount),
    0
  );

  const format = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);

  const veraSummary =
    records.length === 0
      ? "Todavía no tengo movimientos registrados para analizar. Cuando registres tus primeros ingresos y gastos, voy a poder preparar un resumen de tu actividad financiera."
      : income === 0 && expenses === 0
      ? "Tenés movimientos registrados, pero todavía no hay actividad durante este mes. Podés seguir registrando operaciones para mantener actualizado tu panorama."
      : income === 0
      ? `Este mes registraste ${format(expenses)} en gastos y ningún ingreso en ${currency}. Conviene revisar si faltan ingresos por registrar antes de sacar conclusiones sobre tu situación.`
      : expenses > income
      ? `Este mes tus gastos superan tus ingresos registrados por ${format(expenses - income)}. Revisá las categorías de gasto y comprobá que todos los movimientos estén cargados.`
      : `Este mes registraste ${format(income)} en ingresos y ${format(expenses)} en gastos. La diferencia es de ${format(income - expenses)}. Seguí registrando tus movimientos para mantener este análisis actualizado.`;

  return (
    <div>
      <header className="topbar">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">
            Tu información personal y financiera.
          </p>
          <a className="profile-edit-action" href="/perfil/editar">
            Editar perfil financiero
          </a>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Información de la cuenta</h2>
        <p className="card-label">Correo electrónico</p>
        <p style={{ fontWeight: 600, marginTop: 7 }}>{email}</p>
        <p className="card-label" style={{ marginTop: 20 }}>
          Frecuencia de ingresos
        </p>
        <p style={{ fontWeight: 600, marginTop: 7 }}>
          {frequencies[profile?.pay_frequency ?? "not_set"]}
        </p>
        <p className="card-label" style={{ marginTop: 20 }}>
          Ingreso habitual declarado
        </p>
        <p style={{ fontWeight: 600, marginTop: 7 }}>
          {profile?.typical_income
            ? format(Number(profile.typical_income))
            : "No informado"}
        </p>
        <p className="card-label" style={{ marginTop: 20 }}>
          Próximo ingreso esperado
        </p>
        <p style={{ fontWeight: 600, marginTop: 7 }}>
          {profile?.next_pay_date || "No informado"}
        </p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Tu estado financiero</h2>

        <label htmlFor="profile-currency">Moneda de visualización</label>
        <select
          id="profile-currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          style={{ display: "block", padding: 10, marginTop: 8 }}
        >
          {currencies.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <div className="stats-grid" style={{ marginTop: 20 }}>
          <article>
            <p className="card-label">Balance neto registrado</p>
            <h2 className="card-value">{format(balance)}</h2>
          </article>
          <article>
            <p className="card-label">Ingresos del mes</p>
            <h2 className="card-value">{format(income)}</h2>
          </article>
          <article>
            <p className="card-label">Gastos del mes</p>
            <h2 className="card-value">{format(expenses)}</h2>
          </article>
        </div>

        <p className="card-note">
          Basado únicamente en los movimientos registrados. No incluye
          saldos iniciales ni cuentas externas.
        </p>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="section-title">Hábitos y preferencias</h2>

        <p className="card-label">Fuentes de ingresos</p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {profile?.income_sources?.join(", ") || "Sin información"}
        </p>

        <p className="card-label" style={{ marginTop: 20 }}>
          Categorías de gastos habituales
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          {profile?.expense_categories?.join(", ") || "Sin información"}
        </p>
      </section>

      <section className="card">
        <h2 className="section-title">Resumen financiero de VERA</h2>

        <p style={{ color: "#78716C", fontSize: 13, marginBottom: 16 }}>
          Análisis de tu actividad financiera de este mes.
        </p>

        <div className="profile-vera-summary"
          style={{
            background: "linear-gradient(120deg, #191A22, #211E2B)",
            border: "1px solid #40364F",
            color: "#E7E2EC",
            borderRadius: 12,
            padding: 18,
            lineHeight: 1.8,
            fontSize: 14
          }}
        >
          {veraSummary}
        </div>

        <p className="card-note" style={{ marginTop: 14 }}>
          Versión inicial basada en reglas y movimientos registrados.
        </p>
      </section>
    </div>
  );
}
