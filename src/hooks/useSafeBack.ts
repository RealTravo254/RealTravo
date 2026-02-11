import { useNavigate, useLocation } from "react-router-dom";
import { useCallback } from "react";

/**
 * Route parent mapping for parent-aware back navigation.
 * Maps route patterns to their logical parent routes.
 */
const ROUTE_PARENTS: Record<string, string> = {
  // Detail pages → Home
  "/trip/": "/",
  "/event/": "/",
  "/hotel/": "/",
  "/adventure/": "/",
  "/attraction/": "/",
  // Booking flow → Home
  "/booking/": "/",
  "/payment": "/bookings",
  "/payment/verify": "/bookings",
  // Host sub-pages → Host tools
  "/host/item/": "/become-host",
  "/host/bookings/": "/become-host",
  "/host/trips": "/become-host",
  "/host/hotels": "/become-host",
  "/host/experiences": "/become-host",
  "/host-bookings": "/become-host",
  // Creator pages → Host tools
  "/create-trip": "/become-host",
  "/create-hotel": "/become-host",
  "/create-adventure": "/become-host",
  "/create-attraction": "/become-host",
  "/edit-listing/": "/my-listing",
  "/creator-dashboard": "/become-host",
  "/my-listing": "/become-host",
  "/host-verification": "/become-host",
  "/verification-status": "/become-host",
  // Admin sub-pages → Admin dashboard
  "/admin/pending": "/admin",
  "/admin/approved": "/admin",
  "/admin/rejected": "/admin",
  "/admin/review/": "/admin",
  "/admin/bookings": "/admin",
  "/admin/all-bookings": "/admin",
  "/admin/verification": "/admin",
  "/admin/verification/list/": "/admin/verification",
  "/admin/verification-detail/": "/admin/verification",
  "/admin/referral-settings": "/admin",
  // Profile pages
  "/profile/edit": "/profile",
  "/complete-profile": "/profile",
  // Category → Home
  "/category/": "/",
  // Other
  "/qr-scanner": "/become-host",
  "/payment-history": "/payment",
};

/**
 * Finds the logical parent route for the current path.
 */
function getParentRoute(pathname: string): string | null {
  // Check longest prefix matches first (more specific routes)
  const sortedKeys = Object.keys(ROUTE_PARENTS).sort((a, b) => b.length - a.length);
  for (const pattern of sortedKeys) {
    if (pathname.startsWith(pattern) || pathname === pattern.replace(/\/$/, "")) {
      return ROUTE_PARENTS[pattern];
    }
  }
  return null;
}

/**
 * Parent-aware back navigation hook.
 * Uses route hierarchy to determine the correct parent page
 * instead of relying on browser history which can be unpredictable.
 */
export const useSafeBack = (fallback = "/") => {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const parentRoute = getParentRoute(location.pathname);

    if (parentRoute) {
      navigate(parentRoute);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback, location.pathname]);
};
