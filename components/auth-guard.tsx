"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { PRIVACY_VERSION, TERMS_VERSION } from "../lib/legal-versions";
import { supabase } from "../lib/supabase";
import FinanceTrackLoader from "./finance-track-loader";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
        .select("user_id, terms_version, privacy_version")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !acceptance || acceptance.terms_version !== TERMS_VERSION || acceptance.privacy_version !== PRIVACY_VERSION) {
        // Keep Profile reachable so the user can renew an outdated acceptance.
        if (pathname !== "/perfil") {
          router.replace("/perfil");
          return;
        }
      }
      setChecking(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void verify(session);
    });
    supabase.auth.getSession().then(({ data }) => { void verify(data.session); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [pathname, router]);

  if (checking) return <FinanceTrackLoader message="Verificando tu cuenta" />;
  return <>{children}</>;
}
