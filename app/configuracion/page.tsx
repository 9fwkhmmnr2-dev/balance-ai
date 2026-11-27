import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import LogoutButton from "../../components/logout-button";
import LegalConsentSettings from "../../components/legal-consent-settings";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content" style={{maxWidth:900,margin:"0 auto",width:"100%"}}>
            <header style={{marginBottom:24}}>
              <p style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"#8d78b4"}}>FINANCE.TRACK</p>
              <h1 style={{fontSize:30,marginTop:6,color:"#211a2d"}}>Configuración</h1>
              <p style={{marginTop:8,color:"#70677b"}}>Administrá tu cuenta, sesión y condiciones de uso.</p>
            </header>
            <section className="card" style={{marginBottom:20}}>
              <h2 className="section-title">Cuenta</h2>
              <p className="card-note" style={{marginBottom:14}}>Cerrá tu sesión de FINANCE.TRACK desde acá.</p>
              <LogoutButton />
            </section>
            <LegalConsentSettings />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
