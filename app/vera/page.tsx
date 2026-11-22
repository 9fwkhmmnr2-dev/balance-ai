import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import VeraView from "../../components/vera-view";

export default function VeraPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <VeraView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
