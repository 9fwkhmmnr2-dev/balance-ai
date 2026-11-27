"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PRIVACY_VERSION, TERMS_VERSION, VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";

type Acceptance = {
  age_eligible: boolean;
  terms_version: string;
  privacy_version: string;
  vera_terms_version: string | null;
  vera_privacy_version: string | null;
  ai_data_consent: boolean;
};

const cardStyle: React.CSSProperties = {
  marginTop: 20, padding: 18, border: "1px solid #34363D",
  borderRadius: 14, background: "#14161B", color: "#F2F0EB"
};
const labelStyle: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start",
  color: "#D4D1D9", fontSize: 13, lineHeight: 1.6
};

export default function LegalConsentSettings() {
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [veraTerms, setVeraTerms] = useState(false);
  const [veraPrivacy, setVeraPrivacy] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) { setError("Iniciá sesión para consultar tus aceptaciones."); setLoading(false); } return; }
      const { data, error: queryError } = await supabase.from("registration_acceptances")
        .select("age_eligible, terms_version, privacy_version, vera_terms_version, vera_privacy_version, ai_data_consent")
        .eq("user_id", auth.user.id).maybeSingle();
      if (!active) return;
      if (queryError) setError("No pudimos consultar tus permisos. Intentá nuevamente.");
      else if (data) setAcceptance(data as Acceptance);
      else setError("Todavía no existe un registro de aceptaciones para esta cuenta.");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!birthDate || !ageConfirmed || !terms || !privacy || !veraTerms || !veraPrivacy) {
      setError("Completá la fecha de nacimiento y todas las confirmaciones obligatorias.");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

      const generalResponse = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          acceptedTerms: true, acceptedPrivacy: true,
          aiDataConsent: aiConsent, birthDate, confirmAdult: ageConfirmed
        })
      });
      const generalPayload = await generalResponse.json();
      if (!generalResponse.ok) throw new Error(generalPayload.error || "No pudimos actualizar las aceptaciones generales.");

      const veraResponse = await fetch("/api/vera/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ acceptedTerms: true, acceptedPrivacy: true })
      });
      const veraPayload = await veraResponse.json();
      if (!veraResponse.ok) throw new Error(veraPayload.error || "Se guardaron las condiciones generales, pero no pudimos actualizar las de VERA.");

      setAcceptance({
        age_eligible: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION,
        vera_terms_version: VERA_TERMS_VERSION, vera_privacy_version: VERA_PRIVACY_VERSION,
        ai_data_consent: aiConsent
      });
      setMessage("Tus aceptaciones se actualizaron correctamente. Ya podés volver a VERA.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar los cambios.");
    } finally { setSaving(false); }
  }

  if (loading) return <section style={cardStyle}><p style={{ color: "#AAA7B0", fontSize: 13 }}>Consultando permisos y aceptaciones…</p></section>;

  const current = Boolean(acceptance &&
    acceptance.age_eligible &&
    acceptance.terms_version === TERMS_VERSION &&
    acceptance.privacy_version === PRIVACY_VERSION &&
    acceptance.vera_terms_version === VERA_TERMS_VERSION &&
    acceptance.vera_privacy_version === VERA_PRIVACY_VERSION &&
    acceptance.ai_data_consent);

  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: 17, margin: "0 0 7px" }}>Permisos y condiciones de uso</h2>
      <p style={{ color: "#A7A7AD", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        Revisá y actualizá desde acá la edad mínima, los términos, la privacidad y el permiso independiente para el procesamiento mediante IA.
      </p>
      <div style={{ display: "grid", gap: 8, marginBottom: 16, padding: 12, borderRadius: 10, background: "#1D2027" }}>
        <p style={{ fontSize: 12, color: "#D5D1DC" }}>Estado actual</p>
        <p style={{ fontSize: 12, color: acceptance?.age_eligible ? "#9BC7A5" : "#E6A39B" }}>Edad mínima de 18 años: {acceptance?.age_eligible ? "confirmada" : "pendiente"}</p>
        <p style={{ fontSize: 12, color: acceptance?.terms_version === TERMS_VERSION && acceptance?.privacy_version === PRIVACY_VERSION ? "#9BC7A5" : "#E6A39B" }}>Términos y privacidad generales: {acceptance?.terms_version === TERMS_VERSION && acceptance?.privacy_version === PRIVACY_VERSION ? "actualizados" : "requieren actualización"}</p>
        <p style={{ fontSize: 12, color: acceptance?.vera_terms_version === VERA_TERMS_VERSION && acceptance?.vera_privacy_version === VERA_PRIVACY_VERSION ? "#9BC7A5" : "#E6A39B" }}>Términos y privacidad de VERA: {acceptance?.vera_terms_version === VERA_TERMS_VERSION && acceptance?.vera_privacy_version === VERA_PRIVACY_VERSION ? "actualizados" : "requieren actualización"}</p>
        <p style={{ fontSize: 12, color: acceptance?.ai_data_consent ? "#9BC7A5" : "#E6A39B" }}>Procesamiento mediante IA: {acceptance?.ai_data_consent ? "autorizado" : "no autorizado"}</p>
        <p style={{ fontSize: 11, color: "#85838D" }}>Estado completo: {current ? "Todo actualizado" : "Hay aceptaciones pendientes"}</p>
      </div>
      <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="vera-birth-date" style={{ display: "block", color: "#D4D1D9", fontSize: 12, marginBottom: 7 }}>Fecha de nacimiento (solo se utiliza para verificar la edad)</label>
          <input id="vera-birth-date" type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} style={{ width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 8, border: "1px solid #454751", background: "#101116", color: "#F2F0EB" }} />
          <p style={{ color: "#85838D", fontSize: 11, marginTop: 5 }}>La fecha no se guarda en la base de datos. VERA requiere tener al menos 18 años.</p>
        </div>
        <label style={labelStyle}><input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} required style={{ marginTop: 4 }} />Confirmo que tengo 18 años o más y que la fecha indicada es correcta.</label>
        <label style={labelStyle}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required style={{ marginTop: 4 }} /><span>Acepto los <Link href="/terminos" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Términos y Condiciones</Link> vigentes de FINANCE.TRACK.</span></label>
        <label style={labelStyle}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} required style={{ marginTop: 4 }} /><span>Acepto la <Link href="/privacidad" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Política de Privacidad</Link> vigente de FINANCE.TRACK.</span></label>
        <label style={labelStyle}><input type="checkbox" checked={veraTerms} onChange={e => setVeraTerms(e.target.checked)} required style={{ marginTop: 4 }} /><span>Acepto los <Link href="/terminos" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Términos y Condiciones</Link> aplicables a VERA.</span></label>
        <label style={labelStyle}><input type="checkbox" checked={veraPrivacy} onChange={e => setVeraPrivacy(e.target.checked)} required style={{ marginTop: 4 }} /><span>Acepto la <Link href="/privacidad" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Política de Privacidad</Link> aplicable a VERA.</span></label>
        <div style={{ borderTop: "1px solid #34363D", paddingTop: 14 }}>
          <label style={labelStyle}><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} style={{ marginTop: 4 }} /><span>Autorizo por separado el procesamiento de mis mensajes y datos financieros mediante proveedores externos de IA, cuando la función y el proveedor estén habilitados. Este permiso es opcional y puedo revocarlo.</span></label>
        </div>
        {error && <p role="alert" style={{ color: "#E6A39B", fontSize: 12, lineHeight: 1.5 }}>{error}</p>}
        {message && <p role="status" style={{ color: "#9BC7A5", fontSize: 12, lineHeight: 1.5 }}>{message}</p>}
        <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 9, padding: 13, background: "#C8A96B", color: "#17130B", fontWeight: 700, opacity: saving ? .65 : 1 }}>{saving ? "Guardando aceptaciones…" : "Actualizar permisos y aceptaciones"}</button>
      </form>
    </section>
  );
}
