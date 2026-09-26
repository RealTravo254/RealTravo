import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// The dedicated /complete-profile page (src/pages/CompleteProfile.tsx) has
// its own full version of this same flow, including the email-code
// verification step. This gate no longer renders its own overlay on top of
// whatever page the person is on — instead it just sends them to that page,
// so there is exactly one "finish your profile" UI, never a popup stacked
// on top of the app.
const COMPLETE_PROFILE_ROUTE = "/complete-profile";

/**
 * Mount this once near the app root (alongside <AuthModal />) — e.g. in
 * App.tsx, inside <AuthProvider>. It renders nothing until a first-time
 * Google sign-up is detected, at which point it redirects to the dedicated
 * /complete-profile page (name, gender, country, date of birth, password
 * all live there) instead of popping up a modal over the current screen.
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
 * column the /complete-profile page sets to `true` on submit) before
 * redirecting anywhere. If it's already `true`, we sync the context back to
 * "completed" via `markProfileCompleted()` and never redirect.
 *
 * The real, permanent fix is still to make AuthContext read
 * `profiles.profile_completed` directly when computing
 * `needsProfileCompletion` — this component is a safety net on top of
 * that, not a replacement for it.
 */
export const CompleteProfileGate = () => {
  const { user, needsProfileCompletion, markProfileCompleted } = useAuth();
  const location = useLocation();
  const isOnCompleteProfilePage = location.pathname === COMPLETE_PROFILE_ROUTE;

  // Tri-state: we don't know yet / confirmed still incomplete / confirmed done.
  const [dbChecked, setDbChecked] = useState(false);
  const [stillIncomplete, setStillIncomplete] = useState(false);

  useEffect(() => {
    if (!needsProfileCompletion || !user || isOnCompleteProfilePage) {
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
        // Couldn't confirm either way — don't silently skip a possibly
        // genuine "please finish your profile" redirect.
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
  }, [needsProfileCompletion, user, markProfileCompleted, isOnCompleteProfilePage]);

  if (!needsProfileCompletion || !user) return null;
  if (isOnCompleteProfilePage) return null; // that page already handles this itself
  if (!dbChecked) return null; // brief DB round-trip in flight — don't redirect prematurely
  if (!stillIncomplete) return null; // confirmed already complete — never redirect

  return (
    <Navigate
      to={COMPLETE_PROFILE_ROUTE}
      state={{ returnTo: location.pathname + location.search }}
      replace
    />
  );
};