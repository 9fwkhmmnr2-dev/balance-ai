
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando tu cuenta...");

  useEffect(() => {
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

      router.replace("/");
      router.refresh();
    }

    confirmAccount();
  }, [router]);

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#FAFAF9",
      padding: 24,
      color: "#0D0D0D"
    }}>
      <p>{message}</p>
    </main>
  );
}
