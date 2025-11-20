import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

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
import CreateAccommodation from "./pages/CreateAccommodation";
import AccommodationDetail from "./pages/AccommodationDetail";
import ProfileEdit from "./pages/ProfileEdit";
import BecomeHost from "./pages/BecomeHost";
import HostItemDetail from "./pages/HostItemDetail";
import AdminReviewDetail from "./pages/AdminReviewDetail";
import AdminBookings from "./pages/AdminBookings";
import EditListing from "./pages/EditListing";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/CreateTripEvent" element={<CreateTripEvent />} />
              <Route path="/CreateHotel" element={<CreateHotel />} />
              <Route path="/CreateAdventure" element={<CreateAdventure />} />
              <Route path="/CreateAccommodation" element={<CreateAccommodation />} />
              <Route path="/accommodation/:id" element={<AccommodationDetail />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/become-host" element={<BecomeHost />} />
              <Route path="/host-item/:type/:id" element={<HostItemDetail />} />
              <Route path="/admin/review/:type/:id" element={<AdminReviewDetail />} />
              <Route path="/admin/bookings/:type/:id" element={<AdminBookings />} />
              <Route path="/edit-listing/:type/:id" element={<EditListing />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
