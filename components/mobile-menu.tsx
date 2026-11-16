
"use client";

import { useState } from "react";

const navigation = [
  "Inicio",
  "Movimientos",
  "Estadísticas",
  "Objetivos",
  "Comparador",
  "VERA",
  "Configuración"
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-menu">
      <div className="mobile-menu-bar">
        <div className="mobile-brand">
          BALANCE<span>.</span> AI
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </div>

      {open && (
        <nav className="mobile-menu-panel">
          {navigation.map((item, index) => (
            <button
              key={item}
              className={`mobile-nav-item ${index === 0 ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
