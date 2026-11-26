"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MINIMUM_AGE_YEARS } from "@/lib/legal-versions";

export default function LegalAcceptancePage() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [aiDataConsent, setAiDataConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!acceptedTerms || !acceptedPrivacy) {
      setError("Tenés que aceptar los Términos y la Política de Privacidad.");
      return;
    }
    if (!birthDate) {
      setError("Ingresá tu fecha de nacimiento.");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ birthDate, acceptedTerms, acceptedPrivacy, aiDataConsent }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos guardar la aceptación.");
      router.replace("/perfil/editar");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090A0D", color: "#F2F0EB", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 520, background: "#17191F", border: "1px solid #34363D", borderRadius: 18, padding: 26, boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
        <p style={{ color: "#C8A96B", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>FINANCE TRACK</p>
        <h1 style={{ fontSize: 25, margin: "8px 0" }}>Antes de empezar</h1>
        <p style={{ color: "#A7A7AD", fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>Confirmá tu edad y revisá las condiciones de uso y privacidad de tu cuenta.</p>

        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Fecha de nacimiento</label>
        <input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0,10)} style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 9, border: "1px solid #3B3D45", background: "#101116", color: "#F2F0EB", marginBottom: 18 }} />
        <p style={{ color: "#92909A", fontSize: 11, marginTop: -10, marginBottom: 18 }}>FINANCE.TRACK requiere tener al menos {MINIMUM_AGE_YEARS} años. La fecha se verifica y no se conserva en la base de datos.</p>

        <div style={{ display: "grid", gap: 14, margin: "18px 0" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} required style={{ marginTop: 3 }} />
            <span>Acepto los <Link href="/terminos" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Términos y Condiciones</Link>.</span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={acceptedPrivacy} onChange={e => setAcceptedPrivacy(e.target.checked)} required style={{ marginTop: 3 }} />
            <span>Leí y acepto la <Link href="/privacidad" target="_blank" style={{ color: "#D8B66A", textDecoration: "underline" }}>Política de Privacidad</Link>.</span>
          </label>
          <div style={{ borderTop: "1px solid #34363D", paddingTop: 14 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
              <input type="checkbox" checked={aiDataConsent} onChange={e => setAiDataConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Autorizo por separado que, cuando VERA esté habilitada y cumpla los requisitos de sus proveedores, mis mensajes, contexto financiero y documentos enviados para análisis puedan ser procesados por proveedores de IA externos, como Google Gemini. Entiendo que puedo no autorizarlo y que VERA no estará disponible para mí mientras no exista este permiso.</span>
            </label>
          </div>
        </div>
        {error && <p role="alert" style={{ color: "#E6A39B", fontSize: 12, lineHeight: 1.5 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", border: 0, borderRadius: 9, padding: 13, background: "#C8A96B", color: "#17130B", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>{loading ? "Verificando..." : "Aceptar y continuar"}</button>
        <p style={{ color: "#777681", fontSize: 10, lineHeight: 1.5, marginTop: 14 }}>Los documentos legales están en versión preliminar y requieren revisión profesional antes de habilitar el servicio públicamente.</p>
      </form>
    </main>
  );
}
