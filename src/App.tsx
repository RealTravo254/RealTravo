import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageLayout } from "@/components/PageLayout";
import Index from "./pages/Index";
import Saved from "./pages/Saved";
import Bookings from "./pages/Bookings";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Vlog from "./pages/Vlog";
import CategoryDetail from "./pages/CategoryDetail";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import TripDetail from "./pages/TripDetail";
import EventDetail from "./pages/EventDetail";
import HotelDetail from "./pages/HotelDetail";
import AdventurePlaceDetail from "./pages/AdventurePlaceDetail";
import AdminDashboard from "./pages/AdminDashboard";
import CreateTripEvent from "./pages/CreateTripEvent";
import CreateHotel from "./pages/CreateHotel";
import CreateAdventure from "./pages/CreateAdventure";
import ProfileEdit from "./pages/ProfileEdit";
import BecomeHost from "./pages/BecomeHost";
import HostItemDetail from "./pages/HostItemDetail";
import AdminReviewDetail from "./pages/AdminReviewDetail";
import AdminBookings from "./pages/AdminBookings";
import EditListing from "./pages/EditListing";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import HostVerification from "./pages/HostVerification";
import CreateAttraction from "./pages/CreateAttraction";
import AttractionDetail from "./pages/AttractionDetail";
import VerificationStatus from "./pages/VerificationStatus";
import AdminVerification from "./pages/AdminVerification";
import Account from "./pages/Account";
import Payment from "./pages/Payment";
import MyReferrals from "./pages/MyReferrals";
import AdminReferralSettings from "./pages/AdminReferralSettings";
import AdminPaymentVerification from "./pages/AdminPaymentVerification";
import HostBookings from "./pages/HostBookings";
import HostBookingDetails from "./pages/HostBookingDetails";
import MyListing from "./pages/MyListing";
import CreatorDashboard from "./pages/CreatorDashboard";
import PendingApprovalItems from "./pages/admin/PendingApprovalItems";
import ApprovedItems from "./pages/admin/ApprovedItems";
import RejectedItems from "./pages/admin/RejectedItems";
import CategoryTrips from "./pages/host/CategoryTrips";
import CategoryHotels from "./pages/host/CategoryHotels";
import CategoryAttractions from "./pages/host/CategoryAttractions";
import CategoryExperiences from "./pages/host/CategoryExperiences";
import VerificationList from "./pages/admin/VerificationList";
import VerificationDetail from "./pages/admin/VerificationDetail";
import PaymentHistory from "./pages/PaymentHistory";
import Install from "./pages/Install";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <InstallPrompt />
          <PageLayout>
            <div className="w-full">
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
              <Route path="/attraction/:id" element={<AttractionDetail />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/pending" element={<PendingApprovalItems />} />
              <Route path="/admin/approved" element={<ApprovedItems />} />
              <Route path="/admin/rejected" element={<RejectedItems />} />
              <Route path="/admin/review/:itemType/:id" element={<AdminReviewDetail />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
              <Route path="/admin/verification" element={<AdminVerification />} />
              <Route path="/admin/verification/list/:status" element={<VerificationList />} />
              <Route path="/admin/verification-detail/:id" element={<VerificationDetail />} />
              <Route path="/admin/payment-verification" element={<AdminPaymentVerification />} />
              <Route path="/admin/referral-settings" element={<AdminReferralSettings />} />
              <Route path="/become-host" element={<BecomeHost />} />
              <Route path="/create-trip" element={<CreateTripEvent />} />
              <Route path="/create-hotel" element={<CreateHotel />} />
              <Route path="/create-adventure" element={<CreateAdventure />} />
              <Route path="/create-attraction" element={<CreateAttraction />} />
              <Route path="/host/item/:itemType/:id" element={<HostItemDetail />} />
              <Route path="/host/bookings/:itemType" element={<HostBookings />} />
              <Route path="/host/bookings/:itemType/:id" element={<HostBookingDetails />} />
              <Route path="/host/trips" element={<CategoryTrips />} />
              <Route path="/host/hotels" element={<CategoryHotels />} />
              <Route path="/host/attractions" element={<CategoryAttractions />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          </PageLayout>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
