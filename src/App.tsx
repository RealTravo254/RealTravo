import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PageLayout } from "@/components/PageLayout";
import { SmallScreenInstallBanner } from "@/components/SmallScreenInstallBanner";
import { DetailPageSkeleton } from "@/components/detail/DetailPageSkeleton";
import { TealLoader } from "@/components/ui/teal-loader";
 
// Only the Index page loads eagerly - everything else is lazy
import Index from "./pages/Index";

// Lazy load ALL other pages
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const Saved = lazy(() => import("./pages/Saved"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Profile = lazy(() => import("./pages/Profile"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const HotelDetail = lazy(() => import("./pages/HotelDetail"));
const AdventurePlaceDetail = lazy(() => import("./pages/AdventurePlaceDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const HostBookings = lazy(() => import("./pages/HostBookings"));
const HostBookingDetails = lazy(() => import("./pages/HostBookingDetails"));
const HostItemDetail = lazy(() => import("./pages/HostItemDetail"));
const MyListing = lazy(() => import("./pages/MyListing"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const AdminReviewDetail = lazy(() => import("./pages/AdminReviewDetail"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const AdminReferralSettings = lazy(() => import("./pages/AdminReferralSettings"));
const QRScanner = lazy(() => import("./pages/QRScanner"));
const CreateTripEvent = lazy(() => import("./pages/CreateTripEvent"));
const CreateHotel = lazy(() => import("./pages/CreateHotel"));
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


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary re-fetches
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Don't refetch when switching tabs
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1,
    },
  },
});

const App = () => {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SmallScreenInstallBanner />
            <PageLayout>
              <Suspense fallback={<TealLoader />}>
                <div className="w-full">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/saved" element={<Saved />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/category/:category" element={<CategoryDetail />} />
                    <Route path="/trip/:slug" element={<Suspense fallback={<DetailPageSkeleton />}><TripDetail /></Suspense>} />
                    <Route path="/event/:slug" element={<Suspense fallback={<DetailPageSkeleton />}><EventDetail /></Suspense>} />
                    <Route path="/hotel/:slug" element={<Suspense fallback={<DetailPageSkeleton />}><HotelDetail /></Suspense>} />
                    <Route path="/adventure/:slug" element={<Suspense fallback={<DetailPageSkeleton />}><AdventurePlaceDetail /></Suspense>} />
                    <Route path="/attraction/:slug" element={<Suspense fallback={<DetailPageSkeleton />}><AdventurePlaceDetail /></Suspense>} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/edit" element={<ProfileEdit />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/pending" element={<PendingApprovalItems />} />
                    <Route path="/admin/approved" element={<ApprovedItems />} />
                    <Route path="/admin/rejected" element={<RejectedItems />} />
                    <Route path="/admin/review/:itemType/:id" element={<AdminReviewDetail />} />
                    <Route path="/admin/bookings" element={<AdminBookings />} />
                    <Route path="/admin/all-bookings" element={<AllBookings />} />
                    <Route path="/admin/verification" element={<AdminVerification />} />
                    <Route path="/admin/verification/list/:status" element={<VerificationList />} />
                    <Route path="/admin/verification-detail/:id" element={<VerificationDetail />} />
                    <Route path="/admin/referral-settings" element={<AdminReferralSettings />} />
                    <Route path="/become-host" element={<BecomeHost />} />
                    <Route path="/create-trip" element={<CreateTripEvent />} />
                    <Route path="/create-hotel" element={<CreateHotel />} />
                    <Route path="/create-adventure" element={<CreateAdventure />} />
                    <Route path="/create-attraction" element={<CreateAdventure />} />
                    <Route path="/host/item/:itemType/:id" element={<HostItemDetail />} />
                    <Route path="/host/bookings/:itemType" element={<HostBookings />} />
                    <Route path="/host/bookings/:itemType/:id" element={<HostBookingDetails />} />
                    <Route path="/host/trips" element={<CategoryTrips />} />
                    <Route path="/host/hotels" element={<CategoryHotels />} />
                    <Route path="/host/experiences" element={<CategoryExperiences />} />
                    <Route path="/my-listing" element={<MyListing />} />
                    <Route path="/creator-dashboard" element={<CreatorDashboard />} />
                    <Route path="/edit-listing/:itemType/:id" element={<EditListing />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/host-verification" element={<HostVerification />} />
                    <Route path="/verification-status" element={<VerificationStatus />} />
                    
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/payment/verify" element={<PaymentVerify />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/host-bookings" element={<HostBookings />} />
                    <Route path="/host-bookings/:itemType/:id" element={<HostBookingDetails />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/qr-scanner" element={<QRScanner />} />
                    <Route path="/book/:itemType/:itemId" element={<PublicManualBooking />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/booking/:type/:id" element={<BookingPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </Suspense>
            </PageLayout>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
