import AuthGuard from "../../../components/auth-guard";
import OnboardingGate from "../../../components/onboarding-gate";
import MobileMenu from "../../../components/mobile-menu";
import VeraSavingsMode from "../../../components/vera-savings-mode";

export default function VeraSavingsModePage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <VeraSavingsMode />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
