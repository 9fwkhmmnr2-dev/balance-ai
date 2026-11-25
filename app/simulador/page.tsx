import AuthGuard from "@/components/auth-guard";
import OnboardingGate from "@/components/onboarding-gate";
import MobileMenu from "@/components/mobile-menu";
import DecisionSimulator from "@/components/decision-simulator";

export default function SimulatorPage() {
  return <AuthGuard><OnboardingGate><div className="dashboard"><MobileMenu /><main className="main-content"><DecisionSimulator /></main></div></OnboardingGate></AuthGuard>;
}
