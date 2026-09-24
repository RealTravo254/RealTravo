import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { CompleteProfileGate } from "@/components/auth/CompleteProfileGate";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { PageLayout } from "@/components/PageLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthGate } from "@/components/AuthGate";
import { TealLoader } from "@/components/ui/teal-loader";
import { OfflineFullScreen } from "@/components/OfflineIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import VisitTracker from "@/components/VisitTracker";

/**
 * lazyRetry — same as React.lazy, but if a page chunk fails to download
 * (flaky network, brief deploy gap) it waits a moment and tries once more
 * before giving up. If it still fails, the error bubbles up and the
 * stale-deploy recovery in main.tsx (clear service worker + caches, reload
 * once) takes over.
 */
const lazyRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) =>
  lazy(() =>
    factory().catch(
      () =>
        new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => factory().then(resolve, reject), 800);
        }),
    ),
  );

const Index = lazyRetry(() => import("./pages/Index"));
const AccountPage = lazyRetry(() => import("@/pages/AccountPage"));
const CreateHotel = lazyRetry(() => import("./pages/CreateHotel"));
const CountryDivisionsManager = lazyRetry(() => import("@/pages/admin/CountryDivisionsManager"));
const ExploreCountries = lazyRetry(() => import("./pages/ExploreCountries"));

const Auth = lazyRetry(() => import("./pages/Auth"));
const AuthCallback = lazyRetry(() => import("./pages/AuthCallback"));
const AppAuthHandler = lazyRetry(() => import("./pages/AppAuthHandler"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const CategoryDetail = lazyRetry(() => import("./pages/CategoryDetail"));
const Saved = lazyRetry(() => import("./pages/Saved"));
const Bookings = lazyRetry(() => import("./pages/Bookings"));
const Contact = lazyRetry(() => import("./pages/Contact"));
const About = lazyRetry(() => import("./pages/About"));
const Profile = lazyRetry(() => import("./pages/Profile"));
const TripDetail = lazyRetry(() => import("./pages/TripDetail"));
const EventDetail = lazyRetry(() => import("./pages/EventDetail"));
const AdventurePlaceDetail = lazyRetry(() => import("./pages/AdventurePlaceDetail"));
const AdminDashboard = lazyRetry(() => import("./pages/AdminDashboard"));
const BecomeHost = lazyRetry(() => import("./pages/BecomeHost"));
const HostBookings = lazyRetry(() => import("./pages/HostBookings"));
const HostBookingDetails = lazyRetry(() => import("./pages/HostBookingDetails"));
const HostItemDetail = lazyRetry(() => import("./pages/HostItemDetail"));
const MyListing = lazyRetry(() => import("./pages/MyListing"));
const AdminReviewDetail = lazyRetry(() => import("./pages/AdminReviewDetail"));
const AdminBookings = lazyRetry(() => import("./pages/AdminBookings"));
const AdminVerification = lazyRetry(() => import("./pages/AdminVerification"));
const AdminReferralSettings = lazyRetry(() => import("./pages/AdminReferralSettings"));
const QRScanner = lazyRetry(() => import("./pages/QRScanner"));
const CreateTripEvent = lazyRetry(() => import("./pages/CreateTripEvent"));
const CreateAdventure = lazyRetry(() => import("./pages/CreateAdventure"));
const EditListing = lazyRetry(() => import("./pages/EditListing"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const VerifyEmail = lazyRetry(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazyRetry(() => import("./pages/ForgotPassword"));
const HostVerification = lazyRetry(() => import("./pages/HostVerification"));
const VerificationStatus = lazyRetry(() => import("./pages/VerificationStatus"));
const Payment = lazyRetry(() => import("./pages/Payment"));
const PendingApprovalItems = lazyRetry(() => import("./pages/admin/PendingApprovalItems"));
const ApprovedItems = lazyRetry(() => import("./pages/admin/ApprovedItems"));
const RejectedItems = lazyRetry(() => import("./pages/admin/RejectedItems"));
const CategoryTrips = lazyRetry(() => import("./pages/host/CategoryTrips"));
const CategoryHotels = lazyRetry(() => import("./pages/host/CategoryHotels"));
const CategoryExperiences = lazyRetry(() => import("./pages/host/CategoryExperiences"));
const VerificationList = lazyRetry(() => import("./pages/admin/VerificationList"));
const VerificationDetail = lazyRetry(() => import("./pages/admin/VerificationDetail"));
const Install = lazyRetry(() => import("./pages/Install"));
const AllBookings = lazyRetry(() => import("./pages/admin/AllBookings"));
const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const PublicManualBooking = lazyRetry(() => import("./pages/PublicManualBooking"));

const CompleteProfile = lazyRetry(() => import("./pages/CompleteProfile"));
const BookingPage = lazyRetry(() => import("./pages/BookingPage"));
const PaymentVerify = lazyRetry(() => import("./pages/PaymentVerify"));
const TripEventGuide = lazyRetry(() => import("./pages/TripEventGuide"));
const CampsiteGuide = lazyRetry(() => import("./pages/CampsiteGuide"));
const HotelGuide = lazyRetry(() => import("./pages/HotelGuide"));
const AdminPaymentVerification = lazyRetry(() => import("./pages/AdminPaymentVerification"));
const AccountsOverview = lazyRetry(() => import("./pages/admin/AccountsOverview"));
const Explore = lazyRetry(() => import("./pages/Explore"));
const CountyDetail = lazyRetry(() => import("./pages/CountyDetail"));
const AdminWithdrawals = lazyRetry(() => import("./pages/admin/AdminWithdrawals"));
const VisitAnalytics = lazyRetry(() => import("./pages/admin/VisitAnalytics"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Branded loader for Index and Auth pages only
const RealtravoBrandLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
    <img
      src="/fulllogo.png"
      alt="RealTravo"
      style={{ width: "96px", height: "96px", objectFit: "contain" }}
    />
    <span style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "2rem",
      fontWeight: 700,
      letterSpacing: "-0.5px",
      lineHeight: 1,
    }}>
      <span style={{ color: "#0d2b4e" }}>Real </span>
      <span style={{ color: "#008080" }}>Travo</span>
    </span>
    <div
      style={{
        width: "28px",
        height: "28px",
        border: "3px solid #e5e7eb",
        borderTopColor: "#008080",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Offline-aware fallback used as a wrapper where needed
const OfflineFallback = ({ text }: { text: string }) => {
  const isOnline = useOnlineStatus();
  if (!isOnline) return <OfflineFullScreen />;
  return <TealLoader text={text} />;
};

const App = () => {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      e.preventDefault();
    };

    // NOTE: the old chunk-error reload guard was removed from here. Stale
    // deploy recovery (clear service worker + caches, reload once) now lives
    // in main.tsx, so the two don't fight each other.
    window.addEventListener("unhandledrejection", handler);

    return () => {
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthModalProvider>
          <AuthProvider>
            <CurrencyProvider>
              <ScrollToTop />
              <VisitTracker />
              <AuthGate>
                <PageLayout>
                  <div className="w-full">
                    <Routes>
                      {/* Branded Realtravo name loader */}
                      <Route path="/" element={
                        <Suspense fallback={<RealtravoBrandLoader />}>
                          <Index />
                        </Suspense>
                      } />
                      <Route path="/auth" element={
                        <Suspense fallback={<RealtravoBrandLoader />}>
                          <Auth />
                        </Suspense>
                      } />

                      {/* All other routes show page name in loader */}
                      <Route path="/account" element={<Suspense fallback={<OfflineFallback text="Account" />}><AccountPage /></Suspense>} />
                      <Route path="/explore" element={<Suspense fallback={<OfflineFallback text="Explore" />}><Explore /></Suspense>} />

                      {/* Countries explorer: all countries, and one country + its divisions */}
                      <Route path="/explore-countries" element={<Suspense fallback={<OfflineFallback text="Countries" />}><ExploreCountries /></Suspense>} />
                      <Route path="/explore-countries/:countrySlug" element={<Suspense fallback={<OfflineFallback text="Countries" />}><ExploreCountries /></Suspense>} />
                      {/* Short alias for the same page */}
                      <Route path="/countries" element={<Suspense fallback={<OfflineFallback text="Countries" />}><ExploreCountries /></Suspense>} />

                      <Route path="/saved" element={<Suspense fallback={<OfflineFallback text="Saved" />}><Saved /></Suspense>} />
                      <Route path="/bookings" element={<Suspense fallback={<OfflineFallback text="Bookings" />}><Bookings /></Suspense>} />
                      <Route path="/contact" element={<Suspense fallback={<OfflineFallback text="Contact" />}><Contact /></Suspense>} />
                      <Route path="/about" element={<Suspense fallback={<OfflineFallback text="About" />}><About /></Suspense>} />
                      <Route path="/category/:category" element={<Suspense fallback={<OfflineFallback text="Category" />}><CategoryDetail /></Suspense>} />
                      <Route path="/county/:county" element={<Suspense fallback={<OfflineFallback text="County" />}><CountyDetail /></Suspense>} />
                      <Route path="/trip/:slug" element={<Suspense fallback={<OfflineFallback text="Trip Details" />}><TripDetail /></Suspense>} />
                      <Route path="/event/:slug" element={<Suspense fallback={<OfflineFallback text="Event Details" />}><EventDetail /></Suspense>} />
                      <Route path="/adventure/:slug" element={<Suspense fallback={<OfflineFallback text="Adventure Details" />}><AdventurePlaceDetail /></Suspense>} />
                      <Route path="/attraction/:slug" element={<Suspense fallback={<OfflineFallback text="Attraction Details" />}><AdventurePlaceDetail /></Suspense>} />
                      <Route path="/auth/callback" element={<Suspense fallback={<OfflineFallback text="Signing In" />}><AuthCallback /></Suspense>} />
                      <Route path="/app-auth" element={<Suspense fallback={<OfflineFallback text="Authenticating" />}><AppAuthHandler /></Suspense>} />
                      <Route path="/profile" element={<Suspense fallback={<OfflineFallback text="Profile" />}><Profile /></Suspense>} />
                      <Route path="/admin" element={<Suspense fallback={<OfflineFallback text="Admin Dashboard" />}><AdminDashboard /></Suspense>} />
                      <Route path="/admin/pending" element={<Suspense fallback={<OfflineFallback text="Pending Approvals" />}><PendingApprovalItems /></Suspense>} />
                      <Route path="/admin/approved" element={<Suspense fallback={<OfflineFallback text="Approved Items" />}><ApprovedItems /></Suspense>} />
                      <Route path="/admin/rejected" element={<Suspense fallback={<OfflineFallback text="Rejected Items" />}><RejectedItems /></Suspense>} />
                      <Route path="/admin/review/:itemType/:id" element={<Suspense fallback={<OfflineFallback text="Review Details" />}><AdminReviewDetail /></Suspense>} />
                      <Route path="/admin/bookings" element={<Suspense fallback={<OfflineFallback text="Admin Bookings" />}><AdminBookings /></Suspense>} />
                      <Route path="/admin/all-bookings" element={<Suspense fallback={<OfflineFallback text="All Bookings" />}><AllBookings /></Suspense>} />
                      <Route path="/admin/verification" element={<Suspense fallback={<OfflineFallback text="Verification" />}><AdminVerification /></Suspense>} />
                      <Route path="/admin/verification/list/:status" element={<Suspense fallback={<OfflineFallback text="Verification List" />}><VerificationList /></Suspense>} />
                      <Route path="/admin/verification-detail/:id" element={<Suspense fallback={<OfflineFallback text="Verification Detail" />}><VerificationDetail /></Suspense>} />
                      <Route path="/admin/referral-settings" element={<Suspense fallback={<OfflineFallback text="Referral Settings" />}><AdminReferralSettings /></Suspense>} />
                      <Route path="/admin/withdrawals" element={<Suspense fallback={<OfflineFallback text="Withdrawals" />}><AdminWithdrawals /></Suspense>} />
                      <Route path="/become-host" element={<Suspense fallback={<OfflineFallback text="Become a Host" />}><BecomeHost /></Suspense>} />
                      <Route path="/create-trip" element={<Suspense fallback={<OfflineFallback text="Create Trip" />}><CreateTripEvent /></Suspense>} />
                      <Route path="/create-event" element={<Suspense fallback={<OfflineFallback text="Create Event" />}><CreateTripEvent /></Suspense>} />
                      <Route path="/create-adventure" element={<Suspense fallback={<OfflineFallback text="Create Adventure" />}><CreateAdventure /></Suspense>} />
                      <Route path="/create-attraction" element={<Suspense fallback={<OfflineFallback text="Create Attraction" />}><CreateAdventure /></Suspense>} />
                      <Route path="/create-hotel" element={<Suspense fallback={<OfflineFallback text="Create Hotel" />}><CreateHotel /></Suspense>} />
                      <Route path="/host/item/:itemType/:id" element={<Suspense fallback={<OfflineFallback text="Listing Details" />}><HostItemDetail /></Suspense>} />
                      <Route path="/host/bookings/:itemType" element={<Suspense fallback={<OfflineFallback text="Host Bookings" />}><HostBookings /></Suspense>} />
                      <Route path="/host/bookings/:itemType/:id" element={<Suspense fallback={<OfflineFallback text="Booking Details" />}><HostBookingDetails /></Suspense>} />
                      <Route path="/host/trips" element={<Suspense fallback={<OfflineFallback text="My Trips" />}><CategoryTrips /></Suspense>} />
                      <Route path="/host/hotels" element={<Suspense fallback={<OfflineFallback text="My Hotels" />}><CategoryHotels /></Suspense>} />
                      <Route path="/host/experiences" element={<Suspense fallback={<OfflineFallback text="My Experiences" />}><CategoryExperiences /></Suspense>} />
                      <Route path="/my-listing" element={<Suspense fallback={<OfflineFallback text="My Listings" />}><MyListing /></Suspense>} />
                      <Route path="/edit-listing/:itemType/:id" element={<Suspense fallback={<OfflineFallback text="Edit Listing" />}><EditListing /></Suspense>} />
                      <Route path="/reset-password" element={<Suspense fallback={<OfflineFallback text="Reset Password" />}><ResetPassword /></Suspense>} />
                      <Route path="/verify-email" element={<Suspense fallback={<OfflineFallback text="Verify Email" />}><VerifyEmail /></Suspense>} />
                      <Route path="/forgot-password" element={<Suspense fallback={<OfflineFallback text="Forgot Password" />}><ForgotPassword /></Suspense>} />
                      <Route path="/host-verification" element={<Suspense fallback={<OfflineFallback text="Host Verification" />}><HostVerification /></Suspense>} />
                      <Route path="/verification-status" element={<Suspense fallback={<OfflineFallback text="Verification Status" />}><VerificationStatus /></Suspense>} />
                      <Route path="/payment" element={<Suspense fallback={<OfflineFallback text="Payment" />}><Payment /></Suspense>} />
                      <Route path="/payment/verify" element={<Suspense fallback={<OfflineFallback text="Verifying Payment" />}><PaymentVerify /></Suspense>} />
                      <Route path="/install" element={<Suspense fallback={<OfflineFallback text="Install App" />}><Install /></Suspense>} />
                      <Route path="/host-bookings" element={<Suspense fallback={<OfflineFallback text="Host Bookings" />}><HostBookings /></Suspense>} />
                      <Route path="/host-bookings/:itemType/:id" element={<Suspense fallback={<OfflineFallback text="Booking Details" />}><HostBookingDetails /></Suspense>} />
                      <Route path="/terms-of-service" element={<Suspense fallback={<OfflineFallback text="Terms of Service" />}><TermsOfService /></Suspense>} />
                      <Route path="/privacy-policy" element={<Suspense fallback={<OfflineFallback text="Privacy Policy" />}><PrivacyPolicy /></Suspense>} />
                      <Route path="/qr-scanner" element={<Suspense fallback={<OfflineFallback text="QR Scanner" />}><QRScanner /></Suspense>} />
                      <Route path="/book/:itemType/:itemId" element={<Suspense fallback={<OfflineFallback text="Book Now" />}><PublicManualBooking /></Suspense>} />
                      <Route path="/complete-profile" element={<Suspense fallback={<OfflineFallback text="Complete Profile" />}><CompleteProfile /></Suspense>} />
                      <Route path="/booking/:type/:id" element={<Suspense fallback={<OfflineFallback text="Booking" />}><BookingPage /></Suspense>} />
                      <Route path="/trip-event-guide" element={<Suspense fallback={<OfflineFallback text="Trip & Event Guide" />}><TripEventGuide /></Suspense>} />
                      <Route path="/campsite-guide" element={<Suspense fallback={<OfflineFallback text="Campsite Guide" />}><CampsiteGuide /></Suspense>} />
                      <Route path="/hotel-guide" element={<Suspense fallback={<OfflineFallback text="Hotel Guide" />}><HotelGuide /></Suspense>} />
                      <Route path="/admin/payment-verification" element={<Suspense fallback={<OfflineFallback text="Payment Verification" />}><AdminPaymentVerification /></Suspense>} />
                      <Route path="/admin/accounts" element={<Suspense fallback={<OfflineFallback text="Accounts Overview" />}><AccountsOverview /></Suspense>} />
                      <Route path="/admin/analytics" element={<Suspense fallback={<OfflineFallback text="Analytics" />}><VisitAnalytics /></Suspense>} />
                      <Route path="/admin/countries" element={<Suspense fallback={<OfflineFallback text="Countries" />}><CountryDivisionsManager /></Suspense>} />

                      {/* Catch-all: must stay LAST */}
                      <Route path="*" element={<Suspense fallback={<OfflineFallback text="Loading" />}><NotFound /></Suspense>} />
                    </Routes>
                  </div>
                </PageLayout>
              </AuthGate>
              <AuthModal />
              <CompleteProfileGate />
            </CurrencyProvider>
          </AuthProvider>
          </AuthModalProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;