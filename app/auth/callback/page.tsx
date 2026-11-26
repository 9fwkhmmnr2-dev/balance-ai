"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando tu cuenta...");

  useEffect(() => {
    let active = true;
    async function confirmAccount() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        setMessage("No encontramos el código de confirmación. Volvé a registrarte o iniciá sesión.");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage("No pudimos confirmar tu cuenta. El enlace puede haber vencido.");
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMessage("No pudimos verificar tu cuenta. Iniciá sesión nuevamente.");
        return;
      }
      const metadata = auth.user.user_metadata ?? {};
      const birthDate = metadata.registration_birth_date;
      const acceptedTerms = metadata.registration_terms_accepted === true;
      const acceptedPrivacy = metadata.registration_privacy_accepted === true;
      const aiDataConsent = metadata.registration_ai_data_consent === true;

      if (typeof birthDate === "string" && acceptedTerms && acceptedPrivacy) {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          setMessage("Tu cuenta se confirmó, pero necesitamos que vuelvas a iniciar sesión para terminar el registro.");
          return;
        }
        const response = await fetch("/api/legal/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session.access_token}` },
          body: JSON.stringify({ birthDate, acceptedTerms, acceptedPrivacy, aiDataConsent }),
        });
        const payload = await response.json();
        if (!response.ok) {
          if (response.status === 403) {
            await supabase.auth.signOut();
            router.replace("/login?blocked=age");
            return;
          }
          setMessage(payload.error || "No pudimos completar la verificación de edad.");
          return;
        }
        await supabase.auth.updateUser({ data: {
          registration_birth_date: null,
          registration_terms_accepted: null,
          registration_privacy_accepted: null,
          registration_ai_data_consent: null,
        } });
        if (!active) return;
        router.replace("/perfil/editar");
        router.refresh();
        return;
      }
      if (active) router.replace("/legal/accept");
    }
    void confirmAccount();
    return () => { active = false; };
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090A0D", padding: 24, color: "#F2F0EB" }}>
      <p>{message}</p>
    </main>
  );
}
