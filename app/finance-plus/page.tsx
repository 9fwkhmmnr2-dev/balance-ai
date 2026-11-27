import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import FinancePlusView from "../../components/vera-gold-view";

export default function FinancePlusPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <FinancePlusView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
