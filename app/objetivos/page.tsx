// FINANCETRACK · Objetivos de ahorro
import "../../components/financial-goals.css";
import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import FinancialGoalsView from "../../components/financial-goals-view";

export default function FinancialGoalsPage() {
  return <AuthGuard><OnboardingGate><FinancialGoalsView /></OnboardingGate></AuthGuard>;
}
