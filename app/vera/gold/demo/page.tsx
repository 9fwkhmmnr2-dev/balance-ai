import AuthGuard from "../../../../components/auth-guard";
import OnboardingGate from "../../../../components/onboarding-gate";
import MobileMenu from "../../../../components/mobile-menu";
import VeraGoldDemo from "../../../../components/vera-gold-demo";

export default function VeraGoldDemoPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <VeraGoldDemo />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
