"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Inicio", href: "/" },
  { label: "Movimientos", href: "/movimientos" },
  { label: "Mis cuentas", href: "/cuentas" },
  { label: "Transferencias", href: "/transferencias" },
  { label: "Conversor", href: "/conversor" },
  { label: "VERA", href: "/vera" },
  { label: "VERA GOLD", href: "/vera/gold", gold: true },
  { label: "Perfil", href: "/perfil" }
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="mobile-menu">
      <div className="mobile-menu-bar">
        <a className="mobile-brand" href="/" aria-label="FINANCETRACK, ir al inicio">FINANCE<span>.</span>TRACK</a>
        <button
          className="mobile-menu-button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <span className="menu-button-icon" aria-hidden="true">{open ? "×" : "≡"}</span>
          <span>{open ? "Cerrar" : "Menú"}</span>
        </button>
      </div>

      {open && (
        <nav className="mobile-menu-panel" id="mobile-navigation" aria-label="Navegación principal">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href === "/vera" && pathname.startsWith("/vera/"));
            return (
              <a
                key={item.href}
                className={`mobile-nav-item ${active ? "active" : ""} ${item.gold ? "mobile-nav-gold" : ""}`} style={item.gold ? { color: "#C8A96B" } : undefined}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}{item.gold && <span className="mobile-nav-gold-tag" style={{ marginLeft: 8, padding: "2px 6px", border: "1px solid rgba(200,169,107,.35)", borderRadius: 4, color: "#C8A96B", fontSize: 9, letterSpacing: ".12em" }}>GOLD</span>}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
