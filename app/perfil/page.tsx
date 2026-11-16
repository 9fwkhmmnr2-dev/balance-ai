
import AuthGuard from "../../components/auth-guard";
import OnboardingGate from "../../components/onboarding-gate";
import ProfileView from "../../components/profile-view";
import MobileMenu from "../../components/mobile-menu";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <OnboardingGate>
        <div className="dashboard">
          <MobileMenu />
          <main className="main-content">
            <ProfileView />
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
