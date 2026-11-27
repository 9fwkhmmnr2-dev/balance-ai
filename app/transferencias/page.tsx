import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import TransfersView from "../../components/transfers-view";

export default function TransfersPage() {
  return <AuthGuard><OnboardingGate><div className="transfers-shell"><TransfersView /></div></OnboardingGate></AuthGuard>;
}
