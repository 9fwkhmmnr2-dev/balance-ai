"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PRIVACY_VERSION, TERMS_VERSION, VERA_PRIVACY_VERSION, VERA_TERMS_VERSION } from "@/lib/legal-versions";
import FinanceTrackLoader from "./finance-track-loader";

export default function VeraLegalGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function checkAcceptance() {
    setError("");
    setChecking(true);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError("No pudimos verificar tu sesión. Volvé a iniciar sesión.");
      setChecking(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("registration_acceptances")
      .select("age_eligible, terms_version, privacy_version, ai_data_consent, vera_terms_version, vera_privacy_version")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (queryError) {
      setError("No pudimos verificar la aceptación de VERA. Intentá nuevamente.");
      setChecking(false);
      return;
    }
    if (!data || data.age_eligible !== true) {
      setBlockedMessage("VERA está disponible únicamente para cuentas cuya persona titular tenga 18 años o más. La persona titular debe completar la verificación desde Perfil.");
      setChecking(false);
      return;
    }
    if (data.terms_version !== TERMS_VERSION || data.privacy_version !== PRIVACY_VERSION) {
      setBlockedMessage("Primero hay que actualizar los términos y la política de privacidad generales desde Perfil.");
      setChecking(false);
      return;
    }
    if (data.ai_data_consent !== true) {
      setBlockedMessage("La persona titular debe autorizar el procesamiento mediante proveedores de IA desde Perfil para utilizar VERA.");
      setChecking(false);
      return;
    }
    setAccepted(
      data.vera_terms_version === VERA_TERMS_VERSION &&
      data.vera_privacy_version === VERA_PRIVACY_VERSION
    );
    setChecking(false);
  }

  useEffect(() => { void checkAcceptance(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!termsChecked || !privacyChecked) {
      setError("Para continuar, aceptá los Términos y la Política de Privacidad de VERA.");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error("No pudimos comprobar tu sesión. Actualizá la página e intentá nuevamente.");
      let session = sessionData.session;
      if (session && (!session.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 60)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.error || !refreshed.data.session) {
          throw new Error("No pudimos renovar tu sesión. Cerrá y volvé a ingresar para continuar.");
        }
        session = refreshed.data.session;
      }
      const token = session?.access_token;
      if (!token) throw new Error("Tu sesión ya no está activa. Volvé a ingresar para continuar.");
      const response = await fetch("/api/vera/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ acceptedTerms: true, acceptedPrivacy: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos guardar tu aceptación.");
      setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar tu aceptación.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <FinanceTrackLoader message="Verificando las condiciones de VERA" />;
  if (accepted) return <>{children}</>;
  if (blockedMessage) return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#090A0D", color: "#F2F0EB" }}>
      <section style={{ width: "100%", maxWidth: 560, padding: 28, borderRadius: 18, border: "1px solid #34363D", background: "#17191F" }}>
        <p style={{ color: "#C8A96B", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>FINANCE TRACK · VERA</p>
        <h1 style={{ fontSize: 25, margin: "10px 0" }}>Requisitos para utilizar VERA</h1>
        <p style={{ color: "#AAA7B0", fontSize: 14, lineHeight: 1.65 }}>{blockedMessage}</p>
        <Link href="/perfil" style={{ display: "inline-block", marginTop: 18, color: "#D8B66A", textDecoration: "underline" }}>Ir a Perfil</Link>
      </section>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#090A0D", color: "#F2F0EB" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 560, padding: 28, borderRadius: 18, border: "1px solid #34363D", background: "#17191F", boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
        <p style={{ color: "#C8A96B", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>FINANCE TRACK · VERA</p>
        <h1 style={{ fontSize: 27, margin: "10px 0" }}>Antes de conversar con VERA</h1>
        <p style={{ color: "#AAA7B0", fontSize: 14, lineHeight: 1.65 }}>
          La primera vez que ingresás, necesitamos que revises y aceptes las condiciones de uso y privacidad específicas de esta experiencia. Esta confirmación se guarda en tu cuenta y no te la volveremos a pedir mientras estas versiones sigan vigentes.
        </p>
        <div style={{ display: "grid", gap: 14, margin: "24px 0" }}>
          <details style={{ border: "1px solid #34363D", borderRadius: 10, padding: 12, background: "#1D2027" }}>
            <summary style={{ cursor: "pointer", color: "#E7D6B5", fontSize: 13, fontWeight: 600 }}>Permisos y condiciones de uso</summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <Link href="/terminos" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline", fontSize: 13 }}>Ver Términos y Condiciones</Link>
              <Link href="/privacidad" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline", fontSize: 13 }}>Ver Política de Privacidad</Link>
            </div>
          </details>
          <label style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13, lineHeight: 1.6 }}>
            <input type="checkbox" required checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} style={{ marginTop: 4 }} />
            Acepto los Términos y Condiciones de FINANCE.TRACK y VERA.
          </label>
          <label style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13, lineHeight: 1.6 }}>
            <input type="checkbox" required checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} style={{ marginTop: 4 }} />
            Leí y acepto la Política de Privacidad, incluido el tratamiento de datos para VERA.
          </label>
        </div>
        {error && <p role="alert" style={{ color: "#E6A39B", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>{error}</p>}
        <button type="submit" disabled={saving || !termsChecked || !privacyChecked} style={{ width: "100%", border: 0, borderRadius: 9, padding: 14, background: "#C8A96B", color: "#17130B", fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving || !termsChecked || !privacyChecked ? .65 : 1 }}>
          {saving ? "Guardando aceptación..." : "Aceptar y entrar a VERA"}
        </button>
        <p style={{ color: "#777681", fontSize: 10, lineHeight: 1.5, marginTop: 14 }}>
          Esta aceptación es independiente del permiso opcional para procesar información mediante proveedores externos de inteligencia artificial.
        </p>
      </form>
    </main>
  );
}
