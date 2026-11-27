import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import AccountsView from "../../components/accounts-view";

export default function AccountsPage() {
  return <AuthGuard><OnboardingGate><main className="accounts-main"><AccountsView /></main></OnboardingGate></AuthGuard>;
}
