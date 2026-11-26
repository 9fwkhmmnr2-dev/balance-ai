"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import FinanceTrackLoader from "./finance-track-loader";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let checkingUser = false;

    async function verify(session: Session | null) {
      if (checkingUser || !active) return;
      checkingUser = true;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: acceptance, error } = await supabase
        .from("registration_acceptances")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !acceptance) {
        router.replace("/legal/accept");
        return;
      }
      setChecking(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void verify(session);
    });
    supabase.auth.getSession().then(({ data }) => { void verify(data.session); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router]);

  if (checking) return <FinanceTrackLoader message="Verificando tu cuenta" />;
  return <>{children}</>;
}
