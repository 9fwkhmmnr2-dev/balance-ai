"import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import CurrencyConverterView from "../../components/currency-converter-view";

export default function ConverterPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <CurrencyConverterView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
