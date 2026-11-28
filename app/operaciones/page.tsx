"use client";

import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import "./operaciones.css";
import { OperationsContent } from "../../components/operations-view";

export default function OperationsPage() {
  return <AuthGuard><OnboardingGate><OperationsContent /></OnboardingGate></AuthGuard>;
}
