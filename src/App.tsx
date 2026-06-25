import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Corrected clean import string to fix compiler errors
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

const SuspenseFallback = () => {
  const isOnline = useOnlineStatus();
  if (!isOnline) return <OfflineFullScreen />;
  return <TealLoader />;
};

const App = () => {
  useEffect(() => {
    // 1. Unhandled rejection logger
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      e.preventDefault();
    };
    
    // 2. Dynamic import fallback handler (Fixes "MIME type text/html" errors on deployment updates)
    const handleChunkError = (e: ErrorEvent) => {
      const errorMsg = e.message || "";
      if (
        errorMsg.includes("Failed to fetch dynamically imported module") || 
        errorMsg.includes("error loading dynamically imported module")
      ) {
        console.warn("New app version deployment detected. Refreshing assets...");
        window.location.reload();
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
                      <Route path="/" element={<Index />} />
                      <Route path="/explore" element={<Suspense fallback={<SuspenseFallback />}><Explore /></Suspense>} />
                      <Route path="/saved" element={<Suspense fallback={<SuspenseFallback />}><Saved /></Suspense>} />
                      <Route path="/bookings" element={<Suspense fallback={<SuspenseFallback />}><Bookings /></Suspense>} />
                      <Route path="/contact" element={<Suspense fallback={<SuspenseFallback />}><Contact /></Suspense>} />
                      <Route path="/about" element={<Suspense fallback={<SuspenseFallback />}><About /></Suspense>} />
                      <Route path="/category/:category" element={<Suspense fallback={<SuspenseFallback />}><CategoryDetail /></Suspense>} />
                      <Route path="/county/:county" element={<Suspense fallback={<SuspenseFallback />}><CountyDetail /></Suspense>} />
                      <Route path="/trip/:slug" element={<Suspense fallback={<TealLoader />}><TripDetail /></Suspense>} />
                      <Route path="/event/:slug" element={<Suspense fallback={<TealLoader />}><EventDetail /></Suspense>} />
                      <Route path="/adventure/:slug" element={<Suspense fallback={<TealLoader />}><AdventurePlaceDetail /></Suspense>} />
                      <Route path="/attraction/:slug" element={<Suspense fallback={<TealLoader />}><AdventurePlaceDetail /></Suspense>} />
                      <Route path="/auth" element={<Suspense fallback={<SuspenseFallback />}><Auth /></Suspense>} />
                      <Route path="/auth/callback" element={<Suspense fallback={<SuspenseFallback />}><AuthCallback /></Suspense>} />
                      <Route path="/app-auth" element={<Suspense fallback={<SuspenseFallback />}><AppAuthHandler /></Suspense>} />
                      <Route path="/profile" element={<Suspense fallback={<SuspenseFallback />}><Profile /></Suspense>} />
                      <Route path="/profile/edit" element={<Suspense fallback={<SuspenseFallback />}><ProfileEdit /></Suspense>} />
                      <Route path="/admin" element={<Suspense fallback={<SuspenseFallback />}><AdminDashboard /></Suspense>} />
                      <Route path="/admin/pending" element={<Suspense fallback={<SuspenseFallback />}><PendingApprovalItems /></Suspense>} />
                      <Route path="/admin/approved" element={<Suspense fallback={<SuspenseFallback />}><ApprovedItems /></Suspense>} />
                      <Route path="/admin/rejected" element={<Suspense fallback={<SuspenseFallback />}><RejectedItems /></Suspense>} />
                      <Route path="/admin/review/:itemType/:id" element={<Suspense fallback={<SuspenseFallback />}><AdminReviewDetail /></Suspense>} />
                      <Route path="/admin/bookings" element={<Suspense fallback={<SuspenseFallback />}><AdminBookings /></Suspense>} />
                      <Route path="/admin/all-bookings" element={<Suspense fallback={<SuspenseFallback />}><AllBookings /></Suspense>} />
                      <Route path="/admin/verification" element={<Suspense fallback={<SuspenseFallback />}><AdminVerification /></Suspense>} />
                      <Route path="/admin/verification/list/:status" element={<Suspense fallback={<SuspenseFallback />}><VerificationList /></Suspense>} />
                      <Route path="/admin/verification-detail/:id" element={<Suspense fallback={<SuspenseFallback />}><VerificationDetail /></Suspense>} />
                      <Route path="/admin/referral-settings" element={<Suspense fallback={<SuspenseFallback />}><AdminReferralSettings /></Suspense>} />
                      <Route path="/become-host" element={<Suspense fallback={<SuspenseFallback />}><BecomeHost /></Suspense>} />
                      <Route path="/create-trip" element={<Suspense fallback={<SuspenseFallback />}><CreateTripEvent /></Suspense>} />
                      <Route path="/create-event" element={<Suspense fallback={<SuspenseFallback />}><CreateTripEvent /></Suspense>} />
                      <Route path="/create-adventure" element={<Suspense fallback={<SuspenseFallback />}><CreateAdventure /></Suspense>} />
                      <Route path="/create-attraction" element={<Suspense fallback={<SuspenseFallback />}><CreateAdventure /></Suspense>} />
                      <Route path="/host/item/:itemType/:id" element={<Suspense fallback={<SuspenseFallback />}><HostItemDetail /></Suspense>} />
                      <Route path="/host/bookings/:itemType" element={<Suspense fallback={<HostBookings />}><HostBookings /></Suspense>} />
                      <Route path="/host/bookings/:itemType/:id" element={<Suspense fallback={<SuspenseFallback />}><HostBookingDetails /></Suspense>} />
                      <Route path="/host/trips" element={<Suspense fallback={<SuspenseFallback />}><CategoryTrips /></Suspense>} />
                      <Route path="/host/hotels" element={<Suspense fallback={<SuspenseFallback />}><CategoryHotels /></Suspense>} />
                      <Route path="/host/experiences" element={<Suspense fallback={<SuspenseFallback />}><CategoryExperiences /></Suspense>} />
                      <Route path="/my-listing" element={<Suspense fallback={<SuspenseFallback />}><MyListing /></Suspense>} />
                      <Route path="/edit-listing/:itemType/:id" element={<Suspense fallback={<SuspenseFallback />}><EditListing /></Suspense>} />
                      <Route path="/reset-password" element={<Suspense fallback={<SuspenseFallback />}><ResetPassword /></Suspense>} />
                      <Route path="/verify-email" element={<Suspense fallback={<SuspenseFallback />}><VerifyEmail /></Suspense>} />
                      <Route path="/forgot-password" element={<Suspense fallback={<SuspenseFallback />}><ForgotPassword /></Suspense>} />
                      <Route path="/host-verification" element={<Suspense fallback={<SuspenseFallback />}><HostVerification /></Suspense>} />
                      <Route path="/verification-status" element={<Suspense fallback={<SuspenseFallback />}><VerificationStatus /></Suspense>} />
                      <Route path="/payment" element={<Suspense fallback={<SuspenseFallback />}><Payment /></Suspense>} />
                      <Route path="/payment/verify" element={<Suspense fallback={<SuspenseFallback />}><PaymentVerify /></Suspense>} />
                      <Route path="/install" element={<Suspense fallback={<SuspenseFallback />}><Install /></Suspense>} />
                      <Route path="/host-bookings" element={<Suspense fallback={<SuspenseFallback />}><HostBookings /></Suspense>} />
                      <Route path="/host-bookings/:itemType/:id" element={<Suspense fallback={<SuspenseFallback />}><HostBookingDetails /></Suspense>} />
                      <Route path="/terms-of-service" element={<Suspense fallback={<SuspenseFallback />}><TermsOfService /></Suspense>} />
                      <Route path="/privacy-policy" element={<Suspense fallback={<SuspenseFallback />}><PrivacyPolicy /></Suspense>} />
                      <Route path="/qr-scanner" element={<Suspense fallback={<SuspenseFallback />}><QRScanner /></Suspense>} />
                      <Route path="/book/:itemType/:itemId" element={<Suspense fallback={<SuspenseFallback />}><PublicManualBooking /></Suspense>} />
                      <Route path="/complete-profile" element={<Suspense fallback={<SuspenseFallback />}><CompleteProfile /></Suspense>} />
                      <Route path="/booking/:type/:id" element={<Suspense fallback={<SuspenseFallback />}><BookingPage /></Suspense>} />
                      <Route path="/trip-event-guide" element={<Suspense fallback={<SuspenseFallback />}><TripEventGuide /></Suspense>} />
                      <Route path="/campsite-guide" element={<Suspense fallback={<SuspenseFallback />}><CampsiteGuide /></Suspense>} />
                      <Route path="/hotel-guide" element={<Suspense fallback={<HotelGuide />}><HotelGuide /></Suspense>} />
                      <Route path="/payment-history" element={<Suspense fallback={<SuspenseFallback />}><PaymentHistory /></Suspense>} />
                      <Route path="/admin/payment-verification" element={<Suspense fallback={<SuspenseFallback />}><AdminPaymentVerification /></Suspense>} />
                      <Route path="/admin/accounts" element={<Suspense fallback={<SuspenseFallback />}><AccountsOverview /></AccountsOverview>} />
                      <Route path="*" element={<Suspense fallback={<SuspenseFallback />}><NotFound /></Suspense>} />
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