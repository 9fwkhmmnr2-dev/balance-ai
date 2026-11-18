import AuthGuard from "../../../components/auth-guard";
import OnboardingGate from "../../../components/onboarding-gate";
import ProfileView from "../../../components/profile-view";

export default function EditProfilePage() {
  return (
    <AuthGuard>
      <OnboardingGate mode="edit">
        <main className="main-content">
          <ProfileView />
        </main>
      </OnboardingGate>
    </AuthGuard>
  );
}
