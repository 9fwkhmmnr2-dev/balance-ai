
import AuthGuard from "../components/auth-guard";
import LogoutButton from "../components/logout-button";
import MovementsManager from "../components/movements-manager";
import MobileMenu from "../components/mobile-menu";
import OnboardingGate from "../components/onboarding-gate";
import DashboardStats from "../components/dashboard-stats";

const navigation = [
  "Inicio",
  "Movimientos",
  "Estadísticas",
  "Objetivos",
  "Comparador",
  "VERA",
  "Configuración"
];

export default function Home() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />

          <aside className="sidebar">
            <div className="brand">
              <LogoutButton />
              BALANCE<span>.</span> AI
            </div>

            <div className="nav-label">MENÚ PRINCIPAL</div>

            <nav className="nav-list">
              {navigation.map((item, index) => (
                <div
                  key={item}
                  className={`nav-item ${index === 0 ? "active" : ""}`}
                >
                  {item}
                </div>
              ))}
            </nav>

            <div className="nav-label" style={{ marginTop: 28 }}>
              CUENTA
            </div>

            <nav className="nav-list">
              <a className="nav-item" href="/perfil">
                Perfil
              </a>
            </nav>

            <div style={{ marginTop: "auto", color: "#A8A29E", fontSize: 12 }}>
              Personal Finance Intelligence
              <br />
              Version 0.1.0
            </div>
          </aside>

          <main className="main-content">
            <header className="topbar">
              <div>
                <h1 className="page-title">Tu panorama financiero</h1>
                <p className="page-subtitle">
                  Entendé qué está pasando con tu dinero.
                </p>
              </div>
            </header>

            <DashboardStats />

            <section className="card" style={{ marginTop: 22 }}>
              <h2 className="section-title">VERA</h2>

              <p style={{ color: "#78716C", fontSize: 13, lineHeight: 1.7 }}>
                Tu asistente de inteligencia financiera.
              </p>

              <div
                style={{
                  background: "#EFF8FE",
                  borderRadius: 10,
                  padding: 18,
                  marginTop: 18
                }}
              >
                <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                  Hola. Soy VERA. Estoy acá para ayudarte a comprender tus
                  finanzas, organizar tus movimientos y tomar decisiones
                  informadas.
                </p>
              </div>

              <p style={{ color: "#A8A29E", fontSize: 11, marginTop: 14 }}>
                Inteligencia artificial próximamente.
              </p>
            </section>

            <MovementsManager />

            <footer
              style={{
                color: "#A8A29E",
                fontSize: 11,
                textAlign: "center",
                marginTop: 28
              }}
            >
              BALANCE AI · Personal Finance Intelligence
            </footer>
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
