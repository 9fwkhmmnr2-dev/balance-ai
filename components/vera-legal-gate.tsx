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

  useEffect(() => {
    let active = true;
    async function checkAcceptance() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        if (active) setBlockedMessage("No pudimos verificar tu sesión. Volvé a iniciar sesión.");
        if (active) setChecking(false);
        return;
      }
      const { data, error } = await supabase.from("registration_acceptances")
        .select("age_eligible, terms_version, privacy_version, ai_data_consent, vera_terms_version, vera_privacy_version")
        .eq("user_id", auth.user.id).maybeSingle();
      if (!active) return;
      if (error) setBlockedMessage("No pudimos verificar los permisos. Intentá nuevamente.");
      else if (!data || data.age_eligible !== true) setBlockedMessage("VERA está disponible exclusivamente para personas titulares mayores de 18 años. La propia persona titular debe completar la verificación desde Perfil.");
      else if (data.terms_version !== TERMS_VERSION || data.privacy_version !== PRIVACY_VERSION) setBlockedMessage("Actualizá los términos y la política de privacidad desde Perfil.");
      else if (data.ai_data_consent !== true) setBlockedMessage("Para utilizar las funciones de IA de VERA, la persona titular debe autorizar el procesamiento mediante proveedores externos desde Perfil.");
      else if (data.vera_terms_version !== VERA_TERMS_VERSION || data.vera_privacy_version !== VERA_PRIVACY_VERSION) setBlockedMessage("Falta completar la aceptación legal de VERA. Hacelo una sola vez desde Perfil; no volveremos a pedirla dentro de VERA.");
      else setAccepted(true);
      setChecking(false);
    }
    void checkAcceptance();
    return () => { active = false; };
  }, []);

  if (checking) return <FinanceTrackLoader message="Verificando los permisos de VERA" />;
  if (accepted) return <>{children}</>;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#090A0D", color: "#F2F0EB" }}>
      <section style={{ width: "100%", maxWidth: 560, padding: 28, borderRadius: 18, border: "1px solid #34363D", background: "#17191F" }}>
        <p style={{ color: "#C8A96B", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>FINANCE TRACK · VERA</p>
        <h1 style={{ fontSize: 25, margin: "10px 0" }}>Permisos pendientes</h1>
        <p style={{ color: "#AAA7B0", fontSize: 14, lineHeight: 1.65 }}>{blockedMessage}</p>
        <Link href="/perfil" style={{ display: "inline-block", marginTop: 18, color: "#D8B66A", textDecoration: "underline" }}>Ir a Perfil para completar una sola vez</Link>
      </section>
    </main>
  );
}
