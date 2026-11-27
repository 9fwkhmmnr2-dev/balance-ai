"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CurrencyOption = { code: string; name: string; symbol: string; numericCode?: string | null; decimals?: number };

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
  allowFavorites?: boolean;
  variant?: "dark" | "light";
};

export default function CurrencyPicker({ value, onChange, label = "Moneda", disabled = false, allowFavorites = true, variant = "dark" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [favorites, setFavorites] = useState<string[]>(["ARS"]);
  const [loading, setLoading] = useState(true);
  const [favoriteError, setFavoriteError] = useState("");
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [catalogResponse, authResult] = await Promise.all([
          fetch("/api/currencies"),
          supabase.auth.getUser(),
        ]);
        if (catalogResponse.ok) {
          const payload = await catalogResponse.json();
          if (active && Array.isArray(payload.currencies)) setCurrencies(payload.currencies);
        }
        const user = authResult.data.user;
        if (user) {
          const { data, error } = await supabase.from("financial_profiles").select("favorite_currencies").eq("user_id", user.id).maybeSingle();
          if (active && !error && data) {
            setProfileExists(true);
            if (Array.isArray(data.favorite_currencies) && data.favorite_currencies.length) {
              setFavorites(data.favorite_currencies.filter((code: unknown): code is string => typeof code === "string" && /^[A-Z]{3}$/.test(code)));
            }
          }
        }
      } catch {
        // The current value remains selectable even if the catalog is temporarily unavailable.
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selected = currencies.find((item) => item.code === value);
  const filtered = useMemo(() => {
    const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    const needle = normalized(query.trim());
    return currencies
      .filter((item) => !needle || normalized([item.code, item.name, item.symbol].join(" ")).includes(needle))
      .sort((a, b) => {
        const favoriteDifference = Number(favorites.includes(b.code)) - Number(favorites.includes(a.code));
        return favoriteDifference || a.name.localeCompare(b.name, "es");
      });
  }, [currencies, favorites, query]);

  async function toggleFavorite(code: string) {
    setFavoriteError("");
    if (!profileExists) {
      setFavoriteError("Completá tu perfil y aplicá la migración para guardar favoritas.");
      return;
    }
    const next = favorites.includes(code) ? favorites.filter((item) => item !== code) : [...favorites, code];
    if (!next.length) {
      setFavoriteError("Dejá al menos una moneda favorita.");
      return;
    }
    if (next.length > 20) {
      setFavoriteError("Podés guardar hasta 20 monedas favoritas.");
      return;
    }
    setFavorites(next);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase.from("financial_profiles").update({ favorite_currencies: next, updated_at: new Date().toISOString() }).eq("user_id", auth.user.id);
      if (error) {
        setFavorites(favorites);
        setFavoriteError("No se pudieron guardar las favoritas. Aplicá la migración de perfil y reintentá.");
      }
    }
  }

  return (
    <div>
      <button type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setFavoriteError(""); setOpen(true); }}
        style={{ width: "100%", minHeight: variant === "light" ? 45 : 44, boxSizing: "border-box", padding: "10px 12px", borderRadius: variant === "light" ? 9 : 10, border: variant === "light" ? "1px solid #E3DFD5" : "1px solid #343640", background: variant === "light" ? "#FFFFFF" : "#17191F", color: variant === "light" ? "#0D0D0D" : "#F2F0EB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer" }}>
        <span>{selected ? <><strong>{selected.code}</strong> · {selected.name}</> : value || "Seleccionar moneda"}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(5,6,10,.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <section role="dialog" aria-modal="true" aria-label={label} style={{ width: "100%", maxWidth: 460, maxHeight: "85dvh", display: "flex", flexDirection: "column", background: "#211a2d", border: "1px solid #514064", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, color: "#F2F0EB" }}><strong>{label}</strong><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); }} aria-label="Cerrar" style={{ position: "relative", zIndex: 2, cursor: "pointer", touchAction: "manipulation", background: "transparent", color: "#C6C1CD", border: 0, fontSize: 24, lineHeight: 1, padding: 6 }}>×</button></div>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por moneda, código o símbolo..." style={{ width: "100%", boxSizing: "border-box", minHeight: 44, padding: 11, borderRadius: 10, border: "1px solid #514064", background: "#2b2238", color: "#F2F0EB", marginBottom: 10 }} />
            {favoriteError && <p role="alert" style={{ color: "#D49A91", fontSize: 12 }}>{favoriteError}</p>}
            <div style={{ overflowY: "auto", minHeight: 0 }}>
              {loading ? <p style={{ color: "#AAA7B0", padding: 20, textAlign: "center" }}>Cargando monedas...</p> :
                filtered.map((item) => (
                  <div key={item.code} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #30323A" }}>
                    <button type="button" onClick={() => { onChange(item.code); setOpen(false); }} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "11px 4px", border: 0, background: item.code === value ? "#493260" : "transparent", color: "#F2F0EB" }}>
                      <strong style={{ minWidth: 42 }}>{item.code}</strong><span style={{ flex: 1, fontSize: 13 }}>{item.name}</span><span style={{ color: "#AAA7B0" }}>{item.symbol}</span>{item.code === value && <span aria-label="Seleccionada">✓</span>}
                    </button>
                    {allowFavorites && <button type="button" onClick={() => void toggleFavorite(item.code)} aria-label={favorites.includes(item.code) ? "Quitar de favoritas" : "Agregar a favoritas"} title={favorites.includes(item.code) ? "Quitar de favoritas" : "Agregar a favoritas"} style={{ border: 0, background: "transparent", color: favorites.includes(item.code) ? "#C8A96B" : "#777681", fontSize: 19, padding: 8 }}>{favorites.includes(item.code) ? "★" : "☆"}</button>}
                  </div>
                ))}
              {!loading && filtered.length === 0 && <p style={{ color: "#AAA7B0", padding: 20, textAlign: "center" }}>No encontramos coincidencias.</p>}
            </div>
            <p style={{ color: "#777681", fontSize: 10, margin: "10px 2px 0" }}>{allowFavorites ? "Las monedas favoritas aparecen primero. Podés guardar hasta 20." : "Buscá por nombre, código o símbolo."}</p>
          </section>
        </div>
      )}
    </div>
  );
}
