import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LoadingFallback } from "@/components/LoadingFallback";

// Lazy load all page components for better performance
const Index = lazy(() => import("./pages/Index"));
const Saved = lazy(() => import("./pages/Saved"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Vlog = lazy(() => import("./pages/Vlog"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
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
const CreateAttraction = lazy(() => import("./pages/CreateAttraction"));
const AttractionDetail = lazy(() => import("./pages/AttractionDetail"));
const VerificationStatus = lazy(() => import("./pages/VerificationStatus"));
const AdminVerification = lazy(() => import("./pages/AdminVerification"));
const Account = lazy(() => import("./pages/Account"));
const Payment = lazy(() => import("./pages/Payment"));
const MyReferrals = lazy(() => import("./pages/MyReferrals"));
const AdminReferralSettings = lazy(() => import("./pages/AdminReferralSettings"));
const AdminPaymentVerification = lazy(() => import("./pages/AdminPaymentVerification"));
const HostBookings = lazy(() => import("./pages/HostBookings"));
const HostBookingDetails = lazy(() => import("./pages/HostBookingDetails"));
const PendingApprovalItems = lazy(() => import("./pages/admin/PendingApprovalItems"));
const ApprovedItems = lazy(() => import("./pages/admin/ApprovedItems"));
const RejectedItems = lazy(() => import("./pages/admin/RejectedItems"));
const CategoryTrips = lazy(() => import("./pages/host/CategoryTrips"));
const CategoryHotels = lazy(() => import("./pages/host/CategoryHotels"));
const CategoryAttractions = lazy(() => import("./pages/host/CategoryAttractions"));
const CategoryExperiences = lazy(() => import("./pages/host/CategoryExperiences"));
const VerificationList = lazy(() => import("./pages/admin/VerificationList"));
const VerificationDetail = lazy(() => import("./pages/admin/VerificationDetail"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <InstallPrompt />
          <div className="w-full">
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/saved" element={<Saved />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
                <Route path="/vlog" element={<Vlog />} />
                <Route path="/category/:category" element={<CategoryDetail />} />
                <Route path="/trip/:id" element={<TripDetail />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/hotel/:id" element={<HotelDetail />} />
                <Route path="/adventure/:id" element={<AdventurePlaceDetail />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/CreateTripEvent" element={<CreateTripEvent />} />
                <Route path="/CreateHotel" element={<CreateHotel />} />
                <Route path="/CreateAdventure" element={<CreateAdventure />} />
                <Route path="/profile/edit" element={<ProfileEdit />} />
                <Route path="/become-host" element={<BecomeHost />} />
                <Route path="/host-item/:type/:id" element={<HostItemDetail />} />
                <Route path="/admin/review/:type/:id" element={<AdminReviewDetail />} />
                <Route path="/admin/bookings/:type/:id" element={<AdminBookings />} />
                <Route path="/edit-listing/:type/:id" element={<EditListing />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/host-verification" element={<HostVerification />} />
                <Route path="/verification-status" element={<VerificationStatus />} />
                <Route path="/admin/verification" element={<AdminVerification />} />
                <Route path="/create-attraction" element={<CreateAttraction />} />
                <Route path="/attraction/:id" element={<AttractionDetail />} />
                <Route path="/account" element={<Account />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/my-referrals" element={<MyReferrals />} />
                <Route path="/admin/referral-settings" element={<AdminReferralSettings />} />
                <Route path="/admin/payment-verification" element={<AdminPaymentVerification />} />
                <Route path="/host-bookings" element={<HostBookings />} />
                <Route path="/host-bookings/:type/:itemId" element={<HostBookingDetails />} />
                <Route path="/admin/pending-approval" element={<PendingApprovalItems />} />
                <Route path="/admin/approved" element={<ApprovedItems />} />
                <Route path="/admin/rejected" element={<RejectedItems />} />
                <Route path="/host/category/trips" element={<CategoryTrips />} />
                <Route path="/host/category/hotels" element={<CategoryHotels />} />
                <Route path="/host/category/attractions" element={<CategoryAttractions />} />
                <Route path="/host/category/experiences" element={<CategoryExperiences />} />
                <Route path="/admin/verification/:status" element={<VerificationList />} />
                <Route path="/admin/verification-detail/:id" element={<VerificationDetail />} />
                <Route path="/payment-history" element={<PaymentHistory />} />
                <Route path="/install" element={<Install />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
