import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import MobileMenu from "../../components/mobile-menu";
import MarketAnalysisView from "../../components/market-analysis-view";

export default function MarketsPage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <MarketAnalysisView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
