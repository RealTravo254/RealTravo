import { useAuth } from "@/contexts/AuthContext";
import { CompleteGoogleProfileForm } from "@/components/auth/CompleteGoogleProfileForm";

/**
 * Mount this once near the app root (alongside <AuthModal />) — e.g. in
 * App.tsx, inside <AuthProvider>. It renders nothing until a first-time
 * Google sign-up is detected, at which point it blocks the app behind a
 * full-screen overlay until the person finishes their profile (name,
 * gender, country, date of birth, password) — no close button, since a
 * password and confirmed age are required before they can use the app.
 */
export const CompleteProfileGate = () => {
  const { user, needsProfileCompletion, pendingGoogleProfile, markProfileCompleted } = useAuth();

  if (!needsProfileCompletion || !user) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] max-h-[90vh] overflow-y-auto">
        <CompleteGoogleProfileForm
          userId={user.id}
          defaultFirstName={pendingGoogleProfile?.firstName}
          defaultLastName={pendingGoogleProfile?.lastName}
          onComplete={markProfileCompleted}
        />
      </div>
    </div>
  );
};