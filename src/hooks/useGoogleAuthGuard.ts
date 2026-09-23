import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const INTENT_KEY = "rt_google_intent"; // "login" | "signup"
// Accounts created within this window of "now" are treated as freshly
// auto-created by the OAuth round-trip we just completed.
const NEW_ACCOUNT_WINDOW_MS = 15_000;

interface UseGoogleAuthGuardOptions {
  /**
   * Called when a "Login with Google" attempt turns out to hit a brand-new
   * account (no account existed for that Google email before now). Use this
   * to flip the auth modal to the Sign Up tab (and open it, if it isn't).
   */
  onNoAccountFound?: () => void;
}

/**
 * Supabase's `signInWithOAuth` silently creates an account if one doesn't
 * exist yet — there is no server-side "login" vs "signup" distinction for
 * OAuth providers. To fake that distinction on top of it:
 *
 *  1. Right before redirecting to Google, `LoginForm` and `SignupForm` each
 *     stamp `rt_google_intent` in localStorage via `markGoogleAuthIntent`.
 *  2. After Google redirects back and Supabase fires `SIGNED_IN`, this hook
 *     checks the intent. If it was "login" but the account's `created_at`
 *     is basically "just now", that means Supabase just created it for us —
 *     i.e. no account existed. We sign the user back out immediately and
 *     call `onNoAccountFound` so the caller can route them to Sign Up.
 *
 * Mount this ONCE, near the app root (e.g. right next to <AuthModal /> in
 * App.tsx), so it catches the redirect regardless of which route the user
 * lands back on after Google sends them home.
 */
export function useGoogleAuthGuard({ onNoAccountFound }: UseGoogleAuthGuardOptions) {
  const { toast } = useToast();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      const intent = localStorage.getItem(INTENT_KEY);
      if (!intent) return; // not a Google button click we tagged — e.g. plain email/password login
      localStorage.removeItem(INTENT_KEY);

      if (intent !== "login") return; // "signup" intent — creating a new account here is expected

      const user = session.user;
      const createdAtMs = new Date(user.created_at).getTime();
      const justCreated = Date.now() - createdAtMs < NEW_ACCOUNT_WINDOW_MS;

      if (justCreated) {
        await supabase.auth.signOut();
        toast({
          title: "No account found",
          description: "We couldn't find an account for that Google email. Please sign up first.",
          variant: "destructive",
        });
        onNoAccountFound?.();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [toast, onNoAccountFound]);
}

/** Call right before redirecting to Google, from both the login and signup buttons. */
export function markGoogleAuthIntent(intent: "login" | "signup") {
  localStorage.setItem(INTENT_KEY, intent);
}