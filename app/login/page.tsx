
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (error) throw error;

        if (!data.session) {
          setMessage("Cuenta creada. Revisá tu correo para confirmar el registro.");
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Ocurrió un error."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#090A0D",
      padding: 20
    }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%",
        maxWidth: 400,
        background: "#17191F",
        color: "#F2F0EB",
        padding: 30,
        borderRadius: 18,
        border: "1px solid #34363D",
        boxShadow: "0 24px 80px rgba(0,0,0,.38)"
      }}>
        <h1 className="login-brand">FINANCE<span>TRACK</span></h1>
        <p style={{ color: "#A7A7AD", marginBottom: 24 }}>
          {mode === "login" ? "Iniciá sesión en tu cuenta" : "Creá tu cuenta"}
        </p>

        <label className="login-label">
          Correo electrónico
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #3B3D45",
            borderRadius: 9,
            background: "#101116",
            color: "#F2F0EB",
            marginBottom: 18
          }}
        />

        <label style={{ display: "block", marginBottom: 8 }}>
          Contraseña
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            border: "1px solid #3B3D45",
            borderRadius: 9,
            background: "#101116",
            color: "#F2F0EB",
            marginBottom: 18
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 13,
            border: 0,
            borderRadius: 8,
            background: "#C8A96B",
            color: "#17130B",
            fontWeight: 700
          }}
        >
          {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </button>

        {message && (
          <p style={{ color: "#D9B8B5", fontSize: 13, marginTop: 16 }}>
            {message}
          </p>
        )}

        <p className="login-switch">
          {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMessage("");
            }}
            style={{
              border: 0,
              background: "none",
              color: "#C8A96B",
              fontWeight: 600
            }}
          >
            {mode === "login" ? "Registrate" : "Iniciá sesión"}
          </button>
        </p>
      </form>
    </main>
  );
}
