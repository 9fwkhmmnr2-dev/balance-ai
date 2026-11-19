import AuthGuard from "../../../components/auth-guard";
import OnboardingGate from "../../../components/onboarding-gate";
import MobileMenu from "../../../components/mobile-menu";

export default function EditProfilePage() {
  return (
    <AuthGuard>
      <OnboardingGate mode="edit">
        <div className="dashboard profile-edit-page">
          <MobileMenu />
          <main className="main-content">
            <h1 className="page-title profile-edit-title">Editar perfil financiero</h1>
            <p className="page-subtitle profile-edit-subtitle">Actualizá tus datos y preferencias.</p>
          </main>
        </div>
      </OnboardingGate>
    </AuthGuard>
  );
}
