"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useProfileCurrency(fallback = "ARS") {
  const [currency, setCurrency] = useState(fallback);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("financial_profiles")
        .select("default_currency")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (active && typeof data?.default_currency === "string" && /^[A-Z]{3}$/.test(data.default_currency)) {
        setCurrency(data.default_currency);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return currency;
}
