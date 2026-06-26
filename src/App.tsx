import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { PageLayout } from "@/components/PageLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthGate } from "@/components/AuthGate";
import { TealLoader } from "@/components/ui/teal-loader";
import { OfflineFullScreen } from "@/components/OfflineIndicator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AppAuthHandler = lazy(() => import("./pages/AppAuthHandler"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const Saved = lazy(() => import("./pages/Saved"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Profile = lazy(() => import("./pages/Profile"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const AdventurePlaceDetail = lazy(() => import("./pages/AdventurePlaceDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const HostBookings = lazy(() => import("./pages/HostBookings"));
const HostBookingDetails = lazy(() => import("./pages/HostBookingDetails"));
const HostItemDetail = lazy(() => import("./pages/HostItemDetail"));
const MyListing = lazy(() => import("./pages/MyListing"));
const AdminReviewDetail = lazy(() => import("./pages/AdminReviewDetail"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const AdminReferralSettings = lazy(() => import("./pages/AdminReferralSettings"));
const QRScanner = lazy(() => import("./pages/QRScanner"));
const CreateTripEvent = lazy(() => import("./pages/CreateTripEvent"));
const CreateAdventure = lazy(() => import("./pages/CreateAdventure"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const EditListing = lazy(() => import("./pages/EditListing"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const HostVerification = lazy(() => import("./pages/HostVerification"));
const VerificationStatus = lazy(() => import("./pages/VerificationStatus"));
const Payment = lazy(() => import("./pages/Payment"));
const PendingApprovalItems = lazy(() => import("./pages/admin/PendingApprovalItems"));
const ApprovedItems = lazy(() => import("./pages/admin/ApprovedItems"));
const RejectedItems = lazy(() => import("./pages/admin/RejectedItems"));
const CategoryTrips = lazy(() => import("./pages/host/CategoryTrips"));
const CategoryHotels = lazy(() => import("./pages/host/CategoryHotels"));
const CategoryExperiences = lazy(() => import("./pages/host/CategoryExperiences"));
const VerificationList = lazy(() => import("./pages/admin/VerificationList"));
const VerificationDetail = lazy(() => import("./pages/admin/VerificationDetail"));
const Install = lazy(() => import("./pages/Install"));
const AllBookings = lazy(() => import("./pages/admin/AllBookings"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PublicManualBooking = lazy(() => import("./pages/PublicManualBooking"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const PaymentVerify = lazy(() => import("./pages/PaymentVerify"));
const TripEventGuide = lazy(() => import("./pages/TripEventGuide"));
const CampsiteGuide = lazy(() => import("./pages/CampsiteGuide"));
const HotelGuide = lazy(() => import("./pages/HotelGuide"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const AdminPaymentVerification = lazy(() => import("./pages/AdminPaymentVerification"));
const AccountsOverview = lazy(() => import("./pages/admin/AccountsOverview"));
const Explore = lazy(() => import("./pages/Explore"));
const CountyDetail = lazy(() => import("./pages/CountyDetail"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"));

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
  <div className="min-h-screen flex items-center justify-center bg-background">
    <span style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "2.4rem",
      fontWeight: 700,
      letterSpacing: "-0.5px",
      lineHeight: 1,
    }}>
      <span style={{ color: "#0d2b4e" }}>Real</span>
      <span style={{ color: "#008080" }}>travo</span>
    </span>
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

    const handleChunkError = (e: ErrorEvent) => {
      const errorMsg = e.message || "";
      if (
        errorMsg.includes("Failed to fetch dynamically imported module") ||
        errorMsg.includes("error loading dynamically imported module")
      ) {
        const alreadyReloaded = sessionStorage.getItem("chunk_reload");
        if (!alreadyReloaded) {
          sessionStorage.setItem("chunk_reload", "1");
          console.warn("New deployment detected. Refreshing assets...");
          window.location.reload();
        } else {
          console.error("Chunk load failed after reload — not retrying.");
        }
      }
    };

    window.addEventListener("unhandledrejection", handler);
    window.addEventListener("error", handleChunkError);

    return () => {
      window.removeEventListener("unhandledrejection", handler);
      window.removeEventListener("error", handleChunkError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CurrencyProvider>
              <ScrollToTop />
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
                      <Route path="/explore" element={<Suspense fallback={<OfflineFallback text="Explore" />}><Explore /></Suspense>} />
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
                      <Route path="/profile/edit" element={<Suspense fallback={<OfflineFallback text="Edit Profile" />}><ProfileEdit /></Suspense>} />
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
                      <Route path="/payment-history" element={<Suspense fallback={<OfflineFallback text="Payment History" />}><PaymentHistory /></Suspense>} />
                      <Route path="/admin/payment-verification" element={<Suspense fallback={<OfflineFallback text="Payment Verification" />}><AdminPaymentVerification /></Suspense>} />
                      <Route path="/admin/accounts" element={<Suspense fallback={<OfflineFallback text="Accounts Overview" />}><AccountsOverview /></Suspense>} />
                      <Route path="*" element={<Suspense fallback={<OfflineFallback text="Loading" />}><NotFound /></Suspense>} />
                    </Routes>
                  </div>
                </PageLayout>
              </AuthGate>
            </CurrencyProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;