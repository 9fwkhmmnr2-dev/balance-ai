"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import NavigationIcon, { type NavigationIconName } from "./navigation-icon";

const navigation: Array<{ label: string; href: string; icon: NavigationIconName }> = [
  { label: "Inicio", href: "/", icon: "home" },
  { label: "Movimientos", href: "/movimientos", icon: "activity" },
  { label: "Mis cuentas", href: "/cuentas", icon: "wallet" },
  { label: "Objetivos", href: "/objetivos", icon: "target" },
  { label: "Transferencias", href: "/transferencias", icon: "transfer" },
  { label: "Conversor", href: "/conversor", icon: "exchange" },
  { label: "Mercados", href: "/mercados", icon: "markets" },
  { label: "FINANCE WRAPPED", href: "/wrapped", icon: "activity" },
  { label: "VERA IA", href: "/vera", icon: "vera" },
  { label: "Perfil", href: "/perfil", icon: "user" },
  { label: "Configuración", href: "/configuracion", icon: "settings" }
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
                className={`mobile-nav-item ${active ? "active" : ""}`}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <NavigationIcon name={item.icon} className="nav-item-icon" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
