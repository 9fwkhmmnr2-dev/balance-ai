
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AuthGuard({
  children
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else if (active) {
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (!data.session) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return <main style={{ padding: 40 }}>Verificando sesión...</main>;
  }

  return <>{children}</>;
}
