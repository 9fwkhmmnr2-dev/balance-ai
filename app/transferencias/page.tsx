import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import TransfersView from "../../components/transfers-view";

export default function TransfersPage() {
  return <AuthGuard><OnboardingGate><main className="transfers-shell"><TransfersView /></main></OnboardingGate></AuthGuard>;
}
