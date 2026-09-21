import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { registerNativePushNotifications, isNativePlatform } from "@/lib/nativePushNotifications";

interface PendingGoogleProfile {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // True right after a first-time Google sign-up, until the person finishes
  // the "complete your profile" step (name, gender, country, DOB, password).
  needsProfileCompletion: boolean;
  // Best-effort name/avatar Google gave us, to prefill that form.
  pendingGoogleProfile: PendingGoogleProfile | null;
  // Call once the profile-completion form has saved successfully.
  markProfileCompleted: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  needsProfileCompletion: false,
  pendingGoogleProfile: null,
  markProfileCompleted: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<PendingGoogleProfile | null>(null);
  const navigate = useNavigate();

  // Register native push notifications when user signs in
  useEffect(() => {
    if (user && isNativePlatform()) {
      registerNativePushNotifications(user.id);
    }
  }, [user]);


  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // First-time Google sign-up: don't silently finish the profile.
        // Instead, flag it so the UI can show the "complete your profile"
        // form (name, gender, country, date of birth, set password) —
        // no email code needed, since Google already verified the address.
        if (event === 'SIGNED_IN' && session?.user) {
          const isOAuth = session.user.app_metadata?.provider === 'google';
          if (isOAuth) {
            // Defer to avoid deadlock with the auth state change itself.
            setTimeout(async () => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('profile_completed')
                .eq('id', session.user.id)
                .single();

              if (profile && !profile.profile_completed) {
                const googleFullName =
                  session.user.user_metadata?.full_name ||
                  session.user.user_metadata?.name ||
                  "";
                const nameParts = googleFullName.trim().split(/\s+/).filter(Boolean);
                const googleAvatar =
                  session.user.user_metadata?.avatar_url ||
                  session.user.user_metadata?.picture ||
                  null;

                setPendingGoogleProfile({
                  firstName: nameParts[0] || "",
                  lastName: nameParts.slice(1).join(" ") || "",
                  avatarUrl: googleAvatar,
                });
                setNeedsProfileCompletion(true);
              } else {
                setNeedsProfileCompletion(false);
                setPendingGoogleProfile(null);
              }
            }, 100);
          }
        }

        if (event === 'SIGNED_OUT') {
          setNeedsProfileCompletion(false);
          setPendingGoogleProfile(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const markProfileCompleted = () => {
    setNeedsProfileCompletion(false);
    setPendingGoogleProfile(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setNeedsProfileCompletion(false);
    setPendingGoogleProfile(null);
    navigate("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signOut,
        needsProfileCompletion,
        pendingGoogleProfile,
        markProfileCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};