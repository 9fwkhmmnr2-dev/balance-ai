"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout}>
      Cerrar sesión
    </button>
  );
}
