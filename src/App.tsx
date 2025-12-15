import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MobileInstallBanner } from "@/components/MobileInstallBanner";
import { PageLayout } from "@/components/PageLayout";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Critical path pages - load eagerly
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import CategoryDetail from "./pages/CategoryDetail";

// Lazy load non-critical pages to reduce initial bundle size
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
const CreateTripEvent = lazy(() => import("./pages/CreateTripEvent"));
const CreateHotel = lazy(() => import("./pages/CreateHotel"));
const CreateAdventure = lazy(() => import("./pages/CreateAdventure"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const HostItemDetail = lazy(() => import("./pages/HostItemDetail"));
const AdminReviewDetail = lazy(() => import("./pages/AdminReviewDetail"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const EditListing = lazy(() => import("./pages/EditListing"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const HostVerification = lazy(() => import("./pages/HostVerification"));
const VerificationStatus = lazy(() => import("./pages/VerificationStatus"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const Account = lazy(() => import("./pages/Account"));
const Payment = lazy(() => import("./pages/Payment"));
const MyReferrals = lazy(() => import("./pages/MyReferrals"));
const AdminReferralSettings = lazy(() => import("./pages/AdminReferralSettings"));
const AdminPaymentVerification = lazy(() => import("./pages/AdminPaymentVerification"));
const HostBookings = lazy(() => import("./pages/HostBookings"));
const HostBookingDetails = lazy(() => import("./pages/HostBookingDetails"));
const MyListing = lazy(() => import("./pages/MyListing"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const PendingApprovalItems = lazy(() => import("./pages/admin/PendingApprovalItems"));
const ApprovedItems = lazy(() => import("./pages/admin/ApprovedItems"));
const RejectedItems = lazy(() => import("./pages/admin/RejectedItems"));
const CategoryTrips = lazy(() => import("./pages/host/CategoryTrips"));
const CategoryHotels = lazy(() => import("./pages/host/CategoryHotels"));
const CategoryExperiences = lazy(() => import("./pages/host/CategoryExperiences"));
const VerificationList = lazy(() => import("./pages/admin/VerificationList"));
const VerificationDetail = lazy(() => import("./pages/admin/VerificationDetail"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const Install = lazy(() => import("./pages/Install"));
const AllBookings = lazy(() => import("./pages/admin/AllBookings"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <BrowserRouter>
          <AuthProvider>
            <InstallPrompt />
            <MobileInstallBanner />
            <PageLayout>
              <Suspense fallback={<PageLoader />}>
                <div className="w-full">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/saved" element={<Saved />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    
                    <Route path="/category/:category" element={<CategoryDetail />} />
                    <Route path="/trip/:slug" element={<TripDetail />} />
                    <Route path="/event/:slug" element={<EventDetail />} />
                    <Route path="/hotel/:slug" element={<HotelDetail />} />
                    <Route path="/adventure/:slug" element={<AdventurePlaceDetail />} />
                    <Route path="/attraction/:slug" element={<AdventurePlaceDetail />} />
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
                    <Route path="/admin/payment-verification" element={<AdminPaymentVerification />} />
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
                    <Route path="/account" element={<Account />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/payment-history" element={<PaymentHistory />} />
                    <Route path="/my-referrals" element={<MyReferrals />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/host-bookings" element={<HostBookings />} />
                    <Route path="/host-bookings/:itemType/:id" element={<HostBookingDetails />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
