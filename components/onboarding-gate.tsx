
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
  type Dispatch,
  type SetStateAction
} from "react";
import { supabase } from "../lib/supabase";

type PayFrequency =
  | "monthly"
  | "biweekly"
  | "weekly"
  | "daily"
  | "variable"
  | "none";

const incomeOptions = [
  "Sueldo",
  "Trabajo independiente",
  "Negocio propio",
  "Ayuda familiar",
  "Otros"
];

const expenseOptions = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Servicios",
  "Educación",
  "Salud",
  "Entretenimiento",
  "Otros"
];

function toggleItem(
  value: string,
  current: string[],
  setter: Dispatch<SetStateAction<string[]>>
) {
  setter(
    current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
  );
}

export default function OnboardingGate({
  children,
  mode = "onboarding"
}: {
  children: ReactNode;
  mode?: "onboarding" | "edit";
}) {
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [frequency, setFrequency] = useState<PayFrequency | "">("");
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [nextPayDate, setNextPayDate] = useState("");
  const [incomeSources, setIncomeSources] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);

  useEffect(() => {
    async function loadProfile() {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setError("No pudimos verificar tu sesión.");
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("financial_profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        setError("No pudimos cargar tu perfil financiero.");
        setLoading(false);
        return;
      }

      if (data?.onboarding_completed && mode === "onboarding") {
        setCompleted(true);
      }

      if (data) {
        if (data.pay_frequency !== "not_set") {
          setFrequency(data.pay_frequency);
        }
        setIncome(data.typical_income?.toString() ?? "");
        setCurrency(data.currency ?? "ARS");
        setNextPayDate(data.next_pay_date ?? "");
        setIncomeSources(data.income_sources ?? []);
        setExpenseCategories(data.expense_categories ?? []);
      }

      setLoading(false);
    }

    loadProfile();
  }, [mode]);

  async function saveProfile(
    event?: FormEvent<HTMLFormElement>,
    skip = false
  ) {
    event?.preventDefault();
    setError("");

    if (!skip && !frequency) {
      setError("Seleccioná cada cuánto recibís ingresos.");
      return;
    }

    if (!skip && income && Number(income) < 0) {
      setError("El importe no puede ser negativo.");
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setError("No encontramos tu sesión. Volvé a iniciar sesión.");
      setSaving(false);
      return;
    }

    const { error: saveError } = await supabase
      .from("financial_profiles")
      .upsert(
        {
          user_id: userData.user.id,
          pay_frequency: skip ? "not_set" : frequency,
          typical_income: skip || !income ? null : Number(income),
          currency,
          next_pay_date: skip || !nextPayDate ? null : nextPayDate,
          income_sources: skip ? [] : incomeSources,
          expense_categories: skip ? [] : expenseCategories,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      setError("No pudimos guardar tus respuestas. Intentá nuevamente.");
      setSaving(false);
      return;
    }

    setCompleted(true);
    setSaving(false);
  }

  if (loading) {
    return <main className="onboarding-loading">Preparando tu espacio...</main>;
  }

  if (completed) {
    return <>{children}</>;
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-brand">
          FINANCE<span>.</span> AI
        </div>

        <p className="onboarding-step">
          {mode === "edit" ? "TU PERFIL FINANCIERO" : "CONFIGURACIÓN INICIAL · 1 DE 1"}
        </p>

        <h1>{mode === "edit" ? "Actualizá tu perfil financiero." : "Conozcamos tu economía."}</h1>

        <p className="onboarding-description">
          {mode === "edit"
            ? "Actualizá tus ingresos, hábitos y preferencias para que FINANCE AI y VERA mantengan el contexto correcto."
            : "Contanos un poco sobre tus ingresos y gastos para adaptar FINANCE AI a tu realidad. Podés dejar cualquier dato sin completar."}
        </p>

        <form onSubmit={(event) => saveProfile(event)}>
          <div className="onboarding-field">
            <label htmlFor="pay-frequency">
              ¿Cada cuánto recibís ingresos?
            </label>

            <select
              id="pay-frequency"
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as PayFrequency | "")
              }
              required
            >
              <option value="">Seleccionar frecuencia</option>
              <option value="monthly">Mensualmente</option>
              <option value="biweekly">Quincenalmente</option>
              <option value="weekly">Semanalmente</option>
              <option value="daily">Por día o trabajo</option>
              <option value="variable">Varía cada mes</option>
              <option value="none">Actualmente no tengo ingresos</option>
            </select>
          </div>

          <div className="onboarding-field">
            <label htmlFor="typical-income">
              ¿Cuánto recibís aproximadamente?
              <span> (opcional)</span>
            </label>

            <div className="onboarding-income">
              <input
                id="typical-income"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej. 250000"
                value={income}
                onChange={(event) => setIncome(event.target.value)}
              />

              <select
                aria-label="Moneda"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="onboarding-field">
            <label htmlFor="next-pay-date">
              ¿Cuándo esperás tu próximo ingreso?
              <span> (opcional)</span>
            </label>

            <input
              id="next-pay-date"
              type="date"
              value={nextPayDate}
              onChange={(event) => setNextPayDate(event.target.value)}
            />
          </div>

          <div className="onboarding-field">
            <label>¿De dónde vienen tus ingresos?</label>

            <div className="onboarding-options">
              {incomeOptions.map((item) => (
                <label className="onboarding-option" key={item}>
                  <input
                    type="checkbox"
                    checked={incomeSources.includes(item)}
                    onChange={() =>
                      toggleItem(item, incomeSources, setIncomeSources)
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="onboarding-field">
            <label>¿En qué categorías solés gastar?</label>

            <div className="onboarding-options">
              {expenseOptions.map((item) => (
                <label className="onboarding-option" key={item}>
                  <input
                    type="checkbox"
                    checked={expenseCategories.includes(item)}
                    onChange={() =>
                      toggleItem(
                        item,
                        expenseCategories,
                        setExpenseCategories
                      )
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="onboarding-error">{error}</p>}

          <button
            className="onboarding-submit"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Guardando..."
              : mode === "edit"
              ? "Guardar cambios"
              : "Guardar y continuar"}
          </button>

          {mode === "onboarding" && (
            <button
              className="onboarding-skip"
              type="button"
              disabled={saving}
              onClick={() => saveProfile(undefined, true)}
            >
              Completar más tarde
            </button>
          )}

          {mode === "edit" && (
            <a className="onboarding-skip" href="/perfil">
              Volver al perfil sin guardar
            </a>
          )}
        </form>

        <p className="onboarding-privacy">
          Tus respuestas son privadas y podés modificarlas más adelante.
        </p>
      </section>
    </main>
  );
}
