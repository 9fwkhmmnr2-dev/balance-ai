import AuthGuard from "../../../components/auth-guard";
import OnboardingGate from "../../../components/onboarding-gate";
import MobileMenu from "../../../components/mobile-menu";
import VeraGoldView from "../../../components/vera-gold-view";

export default function VeraGoldPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <VeraGoldView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
