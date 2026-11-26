import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import FinanceWrapped from "../../components/finance-wrapped";

export default function WrappedPage() {
  return <AuthGuard><OnboardingGate><div className="wrapped-shell"><FinanceWrapped /></div></OnboardingGate></AuthGuard>;
}
