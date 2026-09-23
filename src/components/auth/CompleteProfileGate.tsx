import { useAuth } from "@/contexts/AuthContext";
import { CompleteGoogleProfileForm } from "@/components/auth/CompleteGoogleProfileForm";

/**
 * Mount this once near the app root (alongside <AuthModal />) — e.g. in
 * App.tsx, inside <AuthProvider>. It renders nothing until a first-time
 * Google sign-up is detected, at which point it blocks the app behind a
 * full-screen overlay until the person finishes their profile (name,
 * gender, country, date of birth, password) — no close button, since
 * password and confirmed age are required before they can use the app.
 *
 * IMPORTANT — "don't show this again once it's been completed" has to be
 * decided in AuthContext, not here: this component just renders whatever
 * `needsProfileCompletion` says. Make sure that flag comes from a DB read
 * of `profiles.profile_completed` (which CompleteGoogleProfileForm sets to
 * `true` on submit) rather than any client-only/session state — otherwise
 * a returning Google user can get flagged as needing it again on a future
 * login even though they already finished it once.
 */
export const CompleteProfileGate = () => {
  const { user, needsProfileCompletion, pendingGoogleProfile, markProfileCompleted } = useAuth();

  if (!needsProfileCompletion || !user) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-xl p-6 lg:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] max-h-[90vh] overflow-y-auto overflow-x-visible">
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