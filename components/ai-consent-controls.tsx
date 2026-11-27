"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AiConsentControls() {
  const [loading, setLoading] = useState(true);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setLoading(false); return; }
      const { data, error } = await supabase.from("registration_acceptances").select("ai_data_consent").eq("user_id", auth.user.id).maybeSingle();
      if (!active) return;
      if (error) setMessage("No pudimos consultar tu preferencia.");
      else setConsented(data?.ai_data_consent === true);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function revoke() {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Iniciá sesión para modificar esta preferencia.");
      const response = await fetch("/api/legal/accept", { method: "DELETE", headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pudimos revocar la autorización.");
      setConsented(false);
      setMessage("Autorización revocada. VERA no podrá enviar tus datos a proveedores de IA.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ color: "#92909A", fontSize: 12 }}>Consultando autorización de IA…</p>;
  return <div style={{ marginTop: 28, padding: 16, border: "1px solid #34363D", borderRadius: 12, background: "#14161B" }}>
    <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Autorización de procesamiento por IA</h2>
    <p style={{ color: "#A7A7AD", fontSize: 13, lineHeight: 1.6 }}>{consented ? "Tenés una autorización activa para que VERA pueda procesar datos mediante proveedores externos cuando la función esté habilitada." : "No hay una autorización activa. Las funciones de VERA que necesiten proveedores externos permanecerán bloqueadas."}</p>
    {consented && <button type="button" disabled={busy} onClick={revoke} style={{ marginTop: 10, border: "1px solid #A65D57", background: "transparent", color: "#E6A39B", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 600 }}>{busy ? "Revocando…" : "Revocar autorización"}</button>}
    {message && <p role="status" style={{ color: "#D8B66A", fontSize: 12, marginTop: 10 }}>{message}</p>}
  </div>;
}
