import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CompleteGoogleProfileForm } from "@/components/auth/CompleteGoogleProfileForm";

/**
 * Mount this once near the app root (alongside <AuthModal />) — e.g. in
 * App.tsx, inside <AuthProvider>. It renders nothing until a first-time
 * Google sign-up is detected, at which point it blocks the app behind a
 * full-screen overlay until the person finishes their profile (name,
 * gender, country, date of birth, password) — no close button, since
 * password and confirmed age are required before they can use the app.
 *
 * WHY THE EXTRA DB CHECK BELOW:
 * `needsProfileCompletion` comes from AuthContext, which we don't have
 * visibility into. If it's derived from something like the auth user's
 * `user_metadata` (populated at email/password signup via `options.data`)
 * rather than the `profiles` table, it will get this wrong for Google
 * users — Google OAuth never fills `user_metadata` the way email signup
 * does, so an EXISTING Google user who already completed their profile
 * once can still look "incomplete" on every future login.
 *
 * To make that impossible regardless of what AuthContext thinks, this
 * component independently checks `profiles.profile_completed` (the exact
 * column CompleteGoogleProfileForm sets to `true` on submit) before
 * rendering anything. If it's already `true`, we sync the context back to
 * "completed" via `markProfileCompleted()` and never show the overlay.
 *
 * The real, permanent fix is still to make AuthContext read
 * `profiles.profile_completed` directly when computing
 * `needsProfileCompletion` — this component is a safety net on top of
 * that, not a replacement for it.
 */
export const CompleteProfileGate = () => {
  const { user, needsProfileCompletion, pendingGoogleProfile, markProfileCompleted } = useAuth();

  // Tri-state: we don't know yet / confirmed still incomplete / confirmed done.
  const [dbChecked, setDbChecked] = useState(false);
  const [stillIncomplete, setStillIncomplete] = useState(false);

  useEffect(() => {
    if (!needsProfileCompletion || !user) {
      setDbChecked(false);
      setStillIncomplete(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Couldn't confirm either way — don't silently hide a possibly
        // genuine "please finish your profile" state.
        setStillIncomplete(true);
        setDbChecked(true);
        return;
      }

      const alreadyCompleted = data?.profile_completed === true;

      if (alreadyCompleted) {
        // Existing account, already finished onboarding — this is a normal
        // returning Google login, not a first-time signup. Tell the context
        // so it stops asking on future renders too.
        markProfileCompleted();
      }

      setStillIncomplete(!alreadyCompleted);
      setDbChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [needsProfileCompletion, user, markProfileCompleted]);

  if (!needsProfileCompletion || !user) return null;
  if (!dbChecked) return null; // brief DB round-trip in flight — don't flash the gate open
  if (!stillIncomplete) return null; // confirmed already complete — never show it

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