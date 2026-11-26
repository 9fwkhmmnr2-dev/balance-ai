import AuthGuard from "../components/auth-guard";
import LogoutButton from "../components/logout-button";
import OnboardingGate from "../components/onboarding-gate";
import DashboardStats from "../components/dashboard-stats";
import QuickMovement from "../components/quick-movement";
import NavigationIcon, { type NavigationIconName } from "../components/navigation-icon";

const navigation = [{ label: "Inicio", href: "/", icon: "home" }, { label: "Movimientos", href: "/movimientos", icon: "activity" }, { label: "Mis cuentas", href: "/cuentas", icon: "wallet" }, { label: "Objetivos", href: "/objetivos", icon: "target" }, { label: "Transferencias", href: "/transferencias", icon: "transfer" }, { label: "Conversor", href: "/conversor", icon: "exchange" }, { label: "VERA", href: "/vera", icon: "vera" }];

export default function Home() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <aside className="sidebar">
            <div className="brand"><LogoutButton />FINANCE<span>.</span>TRACK</div>
            <div className="nav-label">MENÚ PRINCIPAL</div>
            <nav className="nav-list">
              {navigation.map((item) => <a key={item.href} href={item.href} className={`nav-item ${item.href === "/" ? "active" : ""}`}><NavigationIcon name={item.icon as NavigationIconName} className="nav-item-icon" /><span>{item.label}</span></a>)}
            </nav>
            <div className="nav-label" style={{ marginTop: 28 }}>CUENTA</div>
            <nav className="nav-list"><a className="nav-item" href="/perfil"><NavigationIcon name="user" className="nav-item-icon" /><span>Perfil</span></a></nav>
            <div className="sidebar-footer">Personal Finance Intelligence<br />Version 0.1.0</div>
          </aside>
          <main className="main-content">
            <DashboardStats />
            <footer className="dashboard-footer">FINANCETRACK · Entendé tu dinero</footer>
          </main>
          <QuickMovement />
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
