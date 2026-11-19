import AuthGuard from "../components/auth-guard";
import LogoutButton from "../components/logout-button";
import OnboardingGate from "../components/onboarding-gate";
import DashboardStats from "../components/dashboard-stats";
import QuickMovement from "../components/quick-movement";

const navigation = [{ label: "Inicio", href: "/" }, { label: "Movimientos", href: "/movimientos" }];

export default function Home() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <aside className="sidebar">
            <div className="brand"><LogoutButton />FINANCE<span>.</span> AI</div>
            <div className="nav-label">MENÚ PRINCIPAL</div>
            <nav className="nav-list">
              {navigation.map((item) => <a key={item.href} href={item.href} className={`nav-item ${item.href === "/" ? "active" : ""}`}>{item.label}</a>)}
            </nav>
            <div className="nav-label" style={{ marginTop: 28 }}>CUENTA</div>
            <nav className="nav-list"><a className="nav-item" href="/perfil">Perfil</a></nav>
            <div className="sidebar-footer">Personal Finance Intelligence<br />Version 0.1.0</div>
          </aside>
          <main className="main-content">
            <DashboardStats />
            <footer className="dashboard-footer">FINANCE AI · Entendé tu dinero</footer>
          </main>
          <QuickMovement />
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
