"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { parseLocalizedAmount } from "../lib/parse-localized-amount";

type Frequency = "monthly" | "biweekly" | "weekly" | "daily" | "variable" | "none";
type Commitment = {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "monthly" | "yearly";
  due_date: string | null;
  amount_type: "exact" | "approximate";
  cost_type: "fixed" | "variable";
  is_shared: boolean;
  is_active: boolean;
};

const steps = [
  { title: "Tus ingresos", description: "Contanos cómo y cuándo recibís dinero." },
  { title: "Gastos esenciales", description: "Registrá los gastos necesarios de tu vida cotidiana." },
  { title: "Otros compromisos", description: "Sumá cuotas, deudas, suscripciones y obligaciones." },
  { title: "Reserva protegida", description: "Definí cuánto querés mantener reservado." },
  { title: "Revisión", description: "Revisá tu información antes de terminar." }
];

const essentialCategories = [
  { value: "housing", label: "Vivienda" },
  { value: "food", label: "Alimentación y supermercado" },
  { value: "education", label: "Educación" },
  { value: "transport", label: "Transporte" },
  { value: "health", label: "Salud" },
  { value: "services", label: "Servicios del hogar" },
  { value: "other_essential", label: "Otros gastos esenciales" }
];

const otherCategories = [
  { value: "installment", label: "Cuotas" },
  { value: "debt", label: "Deudas y préstamos" },
  { value: "subscription", label: "Suscripciones" },
  { value: "other_commitment", label: "Otros compromisos" }
];

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", minHeight: 44, padding: "10px 12px",
  borderRadius: 10, border: "1px solid #343640", background: "#17191F",
  color: "#F2F0EB", fontSize: 14
};

const labelStyle: React.CSSProperties = {
  display: "block", color: "#D8D5CE", fontSize: 12, fontWeight: 600,
  marginBottom: 7
};

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
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState(0);
  const [frequency, setFrequency] = useState<Frequency | "">("");
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [nextPayDate, setNextPayDate] = useState("");
  const [incomeSources, setIncomeSources] = useState<string[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("housing");
  const [amount, setAmount] = useState("");
  const [commitmentCurrency, setCommitmentCurrency] = useState("ARS");
  const [commitmentFrequency, setCommitmentFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [dueDate, setDueDate] = useState("");
  const [amountType, setAmountType] = useState<"exact" | "approximate">("exact");
  const [costType, setCostType] = useState<"fixed" | "variable">("fixed");
  const [isShared, setIsShared] = useState(false);
  const [reserveAmount, setReserveAmount] = useState("");
  const [reserveCurrency, setReserveCurrency] = useState("ARS");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        if (active) { setError("No pudimos verificar tu sesión."); setLoading(false); }
        return;
      }
      if (!active) return;
      setUserId(auth.user.id);

      const [{ data: profile, error: profileError }, { data: savedCommitments, error: commitmentsError }] = await Promise.all([
        supabase.from("financial_profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("financial_commitments").select("*").eq("user_id", auth.user.id).eq("is_active", true).order("created_at", { ascending: true })
      ]);

      if (profileError) {
        if (active) { setError("No pudimos cargar tu perfil financiero."); setLoading(false); }
        return;
      }
      if (commitmentsError) {
        if (active) { setError("Aplicá primero la migración de compromisos financieros en Supabase para continuar."); setLoading(false); }
        return;
      }
      if (!active) return;

      if (profile) {
        if (profile.pay_frequency && profile.pay_frequency !== "not_set") setFrequency(profile.pay_frequency);
        setIncome(profile.typical_income?.toString() ?? "");
        setCurrency(profile.currency ?? "ARS");
        setNextPayDate(profile.next_pay_date ?? "");
        setIncomeSources(profile.income_sources ?? []);
        setExpenseCategories(profile.expense_categories ?? []);
        setReserveAmount(profile.protected_reserve_amount?.toString() ?? "");
        setReserveCurrency(profile.protected_reserve_currency ?? profile.currency ?? "ARS");
        if (profile.onboarding_completed && mode === "onboarding") setCompleted(true);
      }
      setCommitments((savedCommitments ?? []) as Commitment[]);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (step === 1 && !essentialCategories.some((item) => item.value === category)) {
      setCategory("housing");
    }
    if (step === 2 && !otherCategories.some((item) => item.value === category)) {
      setCategory("installment");
    }
  }, [step, category]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(frequency),
      Boolean(income && Number(parseLocalizedAmount(income)) > 0),
      expenseCategories.length > 0,
      commitments.length > 0,
      Boolean(reserveAmount && parseLocalizedAmount(reserveAmount) !== null && Number(parseLocalizedAmount(reserveAmount)) >= 0)
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [frequency, income, expenseCategories, commitments, reserveAmount]);

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function saveIncome() {
    if (!frequency) throw new Error("Seleccioná la frecuencia de tus ingresos o indicá que actualmente no tenés ingresos.");
    const parsed = income ? parseLocalizedAmount(income) : null;
    if (income && (parsed === null || parsed < 0)) throw new Error("Ingresá un importe válido.");
    const { error: saveError } = await supabase.from("financial_profiles").upsert({
      user_id: userId,
      pay_frequency: frequency,
      typical_income: parsed,
      currency,
      next_pay_date: nextPayDate || null,
      income_sources: incomeSources,
      expense_categories: expenseCategories,
      protected_reserve_amount: reserveAmount ? parseLocalizedAmount(reserveAmount) : null,
      protected_reserve_currency: reserveCurrency,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;
  }

  async function saveCategories() {
    const { error: saveError } = await supabase.from("financial_profiles").update({
      expense_categories: expenseCategories,
      updated_at: new Date().toISOString()
    }).eq("user_id", userId);
    if (saveError) throw saveError;
  }

  async function addCommitment() {
    setError("");
    const parsed = parseLocalizedAmount(amount);
    if (!name.trim()) { setError("Ingresá un nombre para el gasto o compromiso."); return; }
    if (parsed === null || parsed <= 0) { setError("Ingresá un importe válido mayor que cero."); return; }
    setSaving(true);
    const { data, error: insertError } = await supabase.from("financial_commitments").insert({
      user_id: userId,
      name: name.trim(),
      category,
      amount: parsed,
      currency: commitmentCurrency,
      frequency: commitmentFrequency,
      due_date: dueDate || null,
      amount_type: amountType,
      cost_type: costType,
      is_shared: isShared
    }).select("*").single();
    if (insertError) {
      setError("No pudimos guardar el compromiso. Revisá los datos e intentá nuevamente.");
    } else {
      setCommitments((current) => [...current, data as Commitment]);
      setName(""); setAmount(""); setDueDate(""); setIsShared(false);
    }
    setSaving(false);
  }

  async function saveReserve() {
    const parsed = reserveAmount ? parseLocalizedAmount(reserveAmount) : null;
    if (reserveAmount && (parsed === null || parsed < 0)) throw new Error("Ingresá un importe válido para tu reserva.");
    const { error: saveError } = await supabase.from("financial_profiles").update({
      protected_reserve_amount: parsed,
      protected_reserve_currency: reserveCurrency,
      updated_at: new Date().toISOString()
    }).eq("user_id", userId);
    if (saveError) throw saveError;
  }

  async function finish() {
    setSaving(true); setError("");
    try {
      const { error: finishError } = await supabase.from("financial_profiles").update({
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }).eq("user_id", userId);
      if (finishError) throw finishError;
      setCompleted(true);
    } catch {
      setError("No pudimos finalizar la configuración. Tus datos guardados siguen disponibles; intentá nuevamente.");
    } finally { setSaving(false); }
  }

  async function next() {
    setSaving(true); setError("");
    try {
      if (step === 0) await saveIncome();
      if (step === 1 || step === 2) await saveCategories();
      if (step === 3) await saveReserve();
      if (step < steps.length - 1) setStep((current) => current + 1);
      else await finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar los cambios. Intentá nuevamente.");
    } finally { setSaving(false); }
  }

  async function skipStep() {
    setError("");
    if (step === 1 || step === 2) {
      setSaving(true);
      try {
        await saveCategories();
      } catch {
        setSaving(false);
        setError("No pudimos guardar las categorías seleccionadas.");
        return;
      }
      setSaving(false);
    }
    if (step === 3 && reserveAmount) {
      setSaving(true);
      try {
        await saveReserve();
      } catch {
        setSaving(false);
        setError("No pudimos guardar tu reserva.");
        return;
      }
      setSaving(false);
    }
    if (step === 0) {
      setFrequency("none");
      setIncome("");
      setIncomeSources([]);
      setSaving(true);
      const { error: saveError } = await supabase.from("financial_profiles").upsert({
        user_id: userId, pay_frequency: "none", typical_income: null,
        currency, next_pay_date: null, income_sources: [],
        expense_categories: expenseCategories, updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      setSaving(false);
      if (saveError) { setError("No pudimos guardar esta etapa."); return; }
    }
    if (step < steps.length - 1) setStep((current) => current + 1);
    else await finish();
  }

  async function removeCommitment(id: string) {
    const { error: deleteError } = await supabase.from("financial_commitments").delete().eq("id", id).eq("user_id", userId);
    if (deleteError) { setError("No pudimos eliminar este compromiso."); return; }
    setCommitments((current) => current.filter((item) => item.id !== id));
  }

  if (loading) return <main className="financetrack-loading" aria-live="polite"><div className="financetrack-loading-mark">F<span>.</span></div><p>Preparando tu espacio</p><span className="financetrack-loading-line" /></main>;
  if (completed) return <>{children}</>;

  const progressWidth = ((step + 1) / steps.length) * 100;
  const currentCategories = step === 1 ? essentialCategories : otherCategories;

  return (
    <main className="onboarding-page">
      <section className="onboarding-card" style={{ maxWidth: 620 }}>
        <div className="onboarding-brand">FINANCE<span>TRACK</span></div>
        <p className="onboarding-step">{mode === "edit" ? "TU PERFIL FINANCIERO" : "CONFIGURACIÓN INICIAL"}</p>
        <h1>{mode === "edit" ? "Actualizá tu perfil financiero." : "Conozcamos tu economía."}</h1>
        <p className="onboarding-description">Completá tu información poco a poco. Podés volver a cada etapa y modificarla cuando quieras.</p>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "22px 0 9px", color: "#B7B5BC", fontSize: 12 }}>
          <span>Etapa {step + 1} de {steps.length}</span><strong style={{ color: "#C8A96B" }}>{completion}% completo</strong>
        </div>
        <div role="progressbar" aria-label="Completitud del perfil financiero" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} style={{ height: 7, borderRadius: 20, background: "#30323A", overflow: "hidden" }}>
          <div style={{ width: progressWidth + "%", height: "100%", borderRadius: 20, background: "linear-gradient(90deg,#8F72C5,#C8A96B)", transition: "width .25s ease" }} />
        </div>

        <div style={{ display: "flex", gap: 6, margin: "18px 0 24px" }}>
          {steps.map((item, index) => (
            <button key={item.title} type="button" disabled={index > step} onClick={() => setStep(index)} aria-label={`Ir a etapa ${index + 1}: ${item.title}`} style={{ flex: 1, minWidth: 0, border: 0, borderRadius: 8, padding: "9px 4px", background: index === step ? "#30253F" : index < step ? "#29251D" : "#202229", color: index === step ? "#E9DDF7" : "#AAA7B0", fontSize: 10, cursor: index > step ? "not-allowed" : "pointer", opacity: index > step ? 0.5 : 1 }}>{index + 1}. {item.title}</button>
          ))}
        </div>

        <h2 style={{ color: "#F2F0EB", fontSize: 21, marginBottom: 6 }}>{steps[step].title}</h2>
        <p className="onboarding-description" style={{ marginBottom: 22 }}>{steps[step].description}</p>

        {step === 0 && (
          <>
            <div className="onboarding-field">
              <label style={labelStyle} htmlFor="profile-frequency">¿Cada cuánto recibís ingresos?</label>
              <select id="profile-frequency" style={fieldStyle} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency | "")}>
                <option value="">Seleccionar frecuencia</option><option value="monthly">Mensualmente</option><option value="biweekly">Quincenalmente</option><option value="weekly">Semanalmente</option><option value="daily">Por día o trabajo</option><option value="variable">Varía cada mes</option><option value="none">Actualmente no tengo ingresos</option>
              </select>
            </div>
            <div className="onboarding-field">
              <label style={labelStyle} htmlFor="profile-income">Ingreso habitual aproximado (opcional)</label>
              <div className="onboarding-income"><input id="profile-income" style={fieldStyle} inputMode="decimal" placeholder="Ej. 250.000,50" value={income} onChange={(e) => setIncome(e.target.value)} /><select aria-label="Moneda del ingreso" style={{ ...fieldStyle, width: 100 }} value={currency} onChange={(e) => setCurrency(e.target.value)}><option>ARS</option><option>USD</option><option>EUR</option></select></div>
            </div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="profile-pay-date">Próximo ingreso esperado (opcional)</label><input id="profile-pay-date" type="date" style={fieldStyle} value={nextPayDate} onChange={(e) => setNextPayDate(e.target.value)} /></div>
            <div className="onboarding-field"><label style={labelStyle}>Fuentes de ingresos</label><div className="onboarding-options">{["Sueldo","Trabajo independiente","Negocio propio","Ayuda familiar","Otros"].map((item) => <label className="onboarding-option" key={item}><input type="checkbox" checked={incomeSources.includes(item)} onChange={() => toggle(item, incomeSources, setIncomeSources)} />{item}</label>)}</div></div>
          </>
        )}

        {(step === 1 || step === 2) && (
          <>
            <div className="onboarding-field"><label style={labelStyle}>Categorías que querés contemplar</label><div className="onboarding-options">{currentCategories.map((item) => <label className="onboarding-option" key={item.value}><input type="checkbox" checked={expenseCategories.includes(item.value)} onChange={() => toggle(item.value, expenseCategories, setExpenseCategories)} />{item.label}</label>)}</div></div>
            <div style={{ borderTop: "1px solid #30323A", margin: "20px 0" }} />
            <h3 style={{ color: "#F2F0EB", fontSize: 15, marginBottom: 14 }}>Agregar {step === 1 ? "un gasto esencial" : "un compromiso"}</h3>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-name">Nombre</label><input id="commitment-name" style={fieldStyle} placeholder={step === 1 ? "Ej. Alquiler, supermercado..." : "Ej. Cuota, préstamo, suscripción..."} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-category">Categoría</label><select id="commitment-category" style={fieldStyle} value={category} onChange={(e) => setCategory(e.target.value)}>{currentCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-amount">Importe</label><div className="onboarding-income"><input id="commitment-amount" style={fieldStyle} inputMode="decimal" placeholder="Ej. 85000" value={amount} onChange={(e) => setAmount(e.target.value)} /><select aria-label="Moneda del compromiso" style={{ ...fieldStyle, width: 100 }} value={commitmentCurrency} onChange={(e) => setCommitmentCurrency(e.target.value)}><option>ARS</option><option>USD</option><option>EUR</option></select></div></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-frequency">Frecuencia</label><select id="commitment-frequency" style={fieldStyle} value={commitmentFrequency} onChange={(e) => setCommitmentFrequency(e.target.value as "weekly" | "monthly" | "yearly")}><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-due">Vencimiento (opcional)</label><input id="commitment-due" type="date" style={fieldStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-type">Importe</label><select id="commitment-type" style={fieldStyle} value={amountType} onChange={(e) => setAmountType(e.target.value as "exact" | "approximate")}><option value="exact">Exacto</option><option value="approximate">Aproximado</option></select></div>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="commitment-cost-type">Tipo de gasto</label><select id="commitment-cost-type" style={fieldStyle} value={costType} onChange={(e) => setCostType(e.target.value as "fixed" | "variable")}><option value="fixed">Fijo</option><option value="variable">Variable</option></select></div>
            <label className="onboarding-option"><input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />Es un gasto compartido (voy a registrar mi parte)</label>
            <button type="button" className="onboarding-submit" disabled={saving} onClick={addCommitment}>{saving ? "Guardando..." : "Agregar a mi perfil"}</button>
            {commitments.filter((item) => step === 1 ? essentialCategories.some((c) => c.value === item.category) : otherCategories.some((c) => c.value === item.category)).map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1px solid #30323A" }}><div><strong style={{ color: "#F2F0EB", fontSize: 13 }}>{item.name}</strong><p style={{ color: "#92909A", fontSize: 11, marginTop: 3 }}>{item.currency} {Number(item.amount).toLocaleString("es-AR")} · {item.frequency === "monthly" ? "Mensual" : item.frequency === "weekly" ? "Semanal" : "Anual"}</p></div><button type="button" onClick={() => removeCommitment(item.id)} style={{ color: "#D49A91", background: "transparent", border: 0, cursor: "pointer" }}>Quitar</button></div>)}
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ color: "#C6C1CD", fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>La reserva protegida es el dinero que querés mantener disponible para emergencias o necesidades esenciales. VERA la va a respetar al sugerir planes de ahorro.</p>
            <div className="onboarding-field"><label style={labelStyle} htmlFor="reserve-amount">Importe que querés proteger (opcional)</label><div className="onboarding-income"><input id="reserve-amount" style={fieldStyle} inputMode="decimal" placeholder="Ej. 150.000" value={reserveAmount} onChange={(e) => setReserveAmount(e.target.value)} /><select aria-label="Moneda de la reserva" style={{ ...fieldStyle, width: 100 }} value={reserveCurrency} onChange={(e) => setReserveCurrency(e.target.value)}><option>ARS</option><option>USD</option><option>EUR</option></select></div></div>
          </>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: 12 }}>
            {[["Frecuencia de ingresos", frequency ? ({monthly:"Mensual",biweekly:"Quincenal",weekly:"Semanal",daily:"Por día o trabajo",variable:"Variable",none:"Sin ingresos actualmente"} as Record<string,string>)[frequency] : "Pendiente"],["Ingreso habitual", income ? currency + " " + income : "No informado"],["Compromisos registrados", String(commitments.length)],["Categorías de gasto", String(expenseCategories.length)],["Reserva protegida", reserveAmount ? reserveCurrency + " " + reserveAmount : "Sin configurar"]].map(([label,value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #30323A" }}><span style={{ color: "#AAA7B0", fontSize: 13 }}>{label}</span><strong style={{ color: "#F2F0EB", fontSize: 13, textAlign: "right" }}>{value}</strong></div>)}
            <p style={{ color: "#92909A", fontSize: 11, lineHeight: 1.5 }}>Podés volver a cualquier etapa para corregir los datos. La información también se puede editar más adelante desde Mi perfil.</p>
          </div>
        )}

        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button type="button" className="onboarding-skip" disabled={saving || step === 0} onClick={() => { setError(""); setStep((current) => current - 1); }}>Anterior</button>
          <button type="button" className="onboarding-submit" disabled={saving} onClick={step === 4 ? finish : next}>{saving ? "Guardando..." : step === 4 ? "Finalizar perfil" : "Guardar y continuar"}</button>
        </div>
        {step < 4 && <button type="button" className="onboarding-skip" disabled={saving} onClick={skipStep}>Completar esta etapa más tarde</button>}
        {mode === "edit" && <a className="onboarding-skip" href="/perfil">Volver al perfil</a>}
        <p className="onboarding-privacy">Tus datos son privados, podés modificarlos y eliminar compromisos cuando quieras.</p>
      </section>
    </main>
  );
}
