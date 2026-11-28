"use client";

import { useEffect, useState } from "react";
import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import FinancialGoalsView from "../../components/financial-goals-view";
import { OperationsContent } from "../../components/operations-view";
import "../../components/financial-goals.css";
import "../operaciones/operaciones.css";
import "./planificacion.css";

type PlanningTab = "goals" | "actions";

function PlanningContent() {
  const [activeTab, setActiveTab] = useState<PlanningTab>("goals");

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    if (section === "acciones") setActiveTab("actions");
  }, []);

  return (
    <div className="planning-page">
      <MobileMenu />
      <header className="planning-nav">
        <a href="/" className="planning-brand">FINANCE<span>.</span>TRACK</a>
        <nav aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/movimientos">Movimientos</a>
          <a href="/cuentas">Mis cuentas</a>
          <a href="/planificacion" aria-current="page">Planificación</a>
          <a href="/vera">VERA</a>
          <a href="/perfil">Perfil</a>
        </nav>
      </header>

      <main className="planning-main">
        <header className="planning-heading">
          <p className="planning-eyebrow">FINANCE.TRACK</p>
          <h1>Planificación</h1>
          <p>Organizá tus metas y los planes que te ayudan a avanzar, desde un solo lugar.</p>
        </header>

        <div className="planning-tabs" role="tablist" aria-label="Secciones de planificación">
          <button type="button" role="tab" aria-selected={activeTab === "goals"} className={activeTab === "goals" ? "active" : ""} onClick={() => setActiveTab("goals")}>
            Objetivos <span>Metas y progreso</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "actions"} className={activeTab === "actions" ? "active" : ""} onClick={() => setActiveTab("actions")}>
            Planes de acción <span>Operaciones y seguimiento</span>
          </button>
        </div>

        <section className="planning-panel" role="tabpanel">
          {activeTab === "goals" ? <FinancialGoalsView embedded /> : <OperationsContent embedded />}
        </section>

        <p className="planning-future-note">Esta sección se ampliará con simulaciones, seguimiento y replanificación. VERA podrá proponer ajustes, pero cada decisión seguirá bajo tu control.</p>
      </main>
    </div>
  );
}

export default function PlanningPage() {
  return <AuthGuard><OnboardingGate><PlanningContent /></OnboardingGate></AuthGuard>;
}
