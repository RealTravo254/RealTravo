interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Previously required login when running as PWA or Capacitor native app.
 * Now allows free guest browsing on all platforms (browser, PWA, Capacitor).
 * Protected actions (booking, hosting, saved items, etc.) still redirect
 * individually to /auth via each page/component's own check
 * (e.g. NavigationDrawer's `go(path, isProtected)`).
 */
export const AuthGate = ({ children }: AuthGateProps) => {
  return <>{children}</>;
};

/**```previous for authentication to login in app pwa or capacitor
import { useAuth } from "@/contexts/AuthContext";
import { useIsPwa } from "@/hooks/useIsPwa";
import { useIsCapacitor } from "@/hooks/useIsCapacitor";
import { Navigate, useLocation } from "react-router-dom";
import { TealLoader } from "@/components/ui/teal-loader";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Wraps the app to require login when running as PWA or Capacitor native app.
 * Browser users can browse freely without logging in.
 */
/*export const AuthGate = ({ children }: AuthGateProps) => {
  const { user, loading } = useAuth();
  const isPwa = useIsPwa();
  const isCapacitor = useIsCapacitor();
  const location = useLocation();

  // Only gate PWA and Capacitor users
  const requiresAuth = isPwa || isCapacitor;

  if (!requiresAuth) return <>{children}</>;

  // Allow auth-related pages through without login
  const publicPaths = ["/auth", "/reset-password", "/forgot-password", "/verify-email", "/terms-of-service", "/privacy-policy"];
  const isPublicPath = publicPaths.some(p => location.pathname === p);
  if (isPublicPath) return <>{children}</>;

  if (loading) return <TealLoader />;

  if (!user) {
    return <Navigate to="/auth" state={{ returnTo: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
};

``` */