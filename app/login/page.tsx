"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { MINIMUM_AGE_YEARS, PRIVACY_VERSION, TERMS_VERSION } from "../../lib/legal-versions";

function isAdultDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
  return age >= MINIMUM_AGE_YEARS;
}

async function saveAcceptance(accessToken: string, input: { birthDate: string; acceptedTerms: boolean; acceptedPrivacy: boolean; aiDataConsent: boolean }) {
  const response = await fetch("/api/legal/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No pudimos guardar la aceptación.");
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [aiDataConsent, setAiDataConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("blocked") === "age") {
      setMessage("No se puede acceder a FINANCE.TRACK porque requiere tener al menos 18 años.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!isAdultDate(birthDate)) throw new Error("FINANCE.TRACK está disponible únicamente para personas de 18 años o más.");
        if (!acceptedTerms || !acceptedPrivacy) throw new Error("Tenés que aceptar los Términos y la Política de Privacidad.");
        const acceptance = { birthDate, acceptedTerms, acceptedPrivacy, aiDataConsent };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              registration_birth_date: birthDate,
              registration_terms_accepted: acceptedTerms,
              registration_privacy_accepted: acceptedPrivacy,
              registration_ai_data_consent: aiDataConsent,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Cuenta creada. Revisá tu correo para confirmar el registro. Después vas a completar la verificación y pasar a Editar perfil.");
        } else {
          await saveAcceptance(data.session.access_token, acceptance);
          await supabase.auth.updateUser({ data: {
            registration_birth_date: null,
            registration_terms_accepted: null,
            registration_privacy_accepted: null,
            registration_ai_data_consent: null,
          } });
          router.replace("/perfil/editar");
          router.refresh();
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!signInData.user) throw new Error("No pudimos verificar la cuenta. Volvé a iniciar sesión.");

        // Existing accounts must explicitly complete any missing or outdated legal acceptance.
        const { data: acceptance, error: acceptanceError } = await supabase
          .from("registration_acceptances")
          .select("terms_version, privacy_version")
          .eq("user_id", signInData.user.id)
          .maybeSingle();

        if (acceptanceError || !acceptance ||
            acceptance.terms_version !== TERMS_VERSION ||
            acceptance.privacy_version !== PRIVACY_VERSION) {
          router.replace("/legal/accept");
        } else {
          router.replace("/");
        }
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090A0D", padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 440, maxHeight: "94vh", overflowY: "auto", background: "#17191F", color: "#F2F0EB", padding: 28, borderRadius: 18, border: "1px solid #34363D", boxShadow: "0 24px 80px rgba(0,0,0,.38)" }}>
        <h1 className="login-brand">FINANCE<span>TRACK</span></h1>
        <p style={{ color: "#A7A7AD", marginBottom: 24 }}>{mode === "login" ? "Iniciá sesión en tu cuenta" : "Creá tu cuenta para mayores de 18 años"}</p>
        <label className="login-label">Correo electrónico</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #3B3D45", borderRadius: 9, background: "#101116", color: "#F2F0EB", marginBottom: 18 }} />
        <label style={{ display: "block", marginBottom: 8 }}>Contraseña</label>
        <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #3B3D45", borderRadius: 9, background: "#101116", color: "#F2F0EB", marginBottom: 18 }} />

        {mode === "register" && <>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Fecha de nacimiento</label>
          <input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0,10)} style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #3B3D45", borderRadius: 9, background: "#101116", color: "#F2F0EB", marginBottom: 14 }} />
          <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
            <label style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.5 }}><input type="checkbox" required checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} /> <span>Acepto los <Link href="/terminos" target="_blank" style={{ color: "#D8B66A" }}>Términos y Condiciones</Link>.</span></label>
            <label style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.5 }}><input type="checkbox" required checked={acceptedPrivacy} onChange={e => setAcceptedPrivacy(e.target.checked)} /> <span>Acepto la <Link href="/privacidad" target="_blank" style={{ color: "#D8B66A" }}>Política de Privacidad</Link>.</span></label>
            <label style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.5 }}><input type="checkbox" checked={aiDataConsent} onChange={e => setAiDataConsent(e.target.checked)} /> <span>Autorizo por separado el procesamiento de mis mensajes, contexto financiero y documentos por proveedores externos de IA únicamente cuando el proveedor y el tipo de servicio permitan tratar datos financieros y VERA esté habilitada. Esta autorización es opcional y revocable; sin ella, VERA no estará disponible.</span></label>
          </div>
        </>}

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, border: 0, borderRadius: 8, background: "#C8A96B", color: "#17130B", fontWeight: 700 }}>{loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
        {message && <p role="alert" style={{ color: "#D9B8B5", fontSize: 13, marginTop: 16, lineHeight: 1.5 }}>{message}</p>}
        <p className="login-switch">{mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }} style={{ border: 0, background: "none", color: "#C8A96B", fontWeight: 600 }}>{mode === "login" ? "Registrate" : "Iniciá sesión"}</button>
        </p>
      </form>
    </main>
  );
}
