import AuthGuard from "../../../components/auth-guard";
import OnboardingGate from "../../../components/onboarding-gate";
import MobileMenu from "../../../components/mobile-menu";

export default function EditProfilePage() {
  return (
    <AuthGuard>
      <>
        <MobileMenu />
        <OnboardingGate mode="edit">
          <main className="main-content">
            <h1 className="page-title profile-edit-title">Editar perfil financiero</h1>
            <p className="page-subtitle profile-edit-subtitle">Actualizá tus datos y preferencias.</p>
          </main>
        </OnboardingGate>
      </>
    </AuthGuard>
  );
}
