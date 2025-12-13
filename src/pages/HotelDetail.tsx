import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Icons will be Teal: #008080
import { MapPin, Phone, Share2, Mail, Calendar, Clock, ArrowLeft, Heart, Copy } from "lucide-react"; 
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { ReviewSection } from "@/components/ReviewSection";
import Autoplay from "embla-carousel-autoplay";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";

interface Facility {
  name: string;
  price: number;
  capacity: number;
}
interface Activity {
  name: string;
  price: number;
}
interface Hotel {
  id: string;
  name: string;
  local_name: string | null;
  location: string;
  place: string;
  country: string;
  image_url: string;
  images: string[];
  gallery_images: string[];
  description: string;
  amenities: string[];
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  opening_hours: string;
  closing_hours: string;
  days_opened: string[];
  registration_number: string;
  map_link: string;
  establishment_type: string;
  available_rooms: number;
  created_by: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Define the custom colors
const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";
const RED_COLOR = "#EF4444"; 

const HotelDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { position } = useGeolocation();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isSaved = savedItems.has(id || "");

  // Calculate distance if position and hotel coordinates available
  const distance = position && hotel?.latitude && hotel?.longitude
    ? calculateDistance(position.latitude, position.longitude, hotel.latitude, hotel.longitude)
    : undefined;

  useEffect(() => {
    fetchHotel();
    
    // Track referral clicks
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "hotel", "booking");
    }
  }, [id]);

  const fetchHotel = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from("hotels").select("*").eq("id", id).single();
      
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase
          .from("hotels")
          .select("*")
          .ilike("id", `${id}%`)
          .single();
        if (!prefixError) {
          data = prefixData;
          error = null;
        }
      }
      
      if (error) throw error;
      setHotel(data as any);
    } catch (error) {
      console.error("Error fetching hotel:", error);
      toast({
        title: "Error",
        description: "Failed to load hotel details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "hotel");
    }
  };

  const handleCopyLink = async () => {
    if (!hotel) {
      toast({ title: "Unable to Copy", description: "Hotel information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(hotel.id, "hotel", hotel.id);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this hotel with others!" 
      });
    } catch (error) {
      toast({ 
        title: "Copy Failed", 
        description: "Unable to copy link to clipboard", 
        variant: "destructive" 
      });
    }
  };

  const handleShare = async () => {
    if (!hotel) {
      toast({ title: "Unable to Share", description: "Hotel information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(hotel.id, "hotel", hotel.id);

    if (navigator.share) {
      try {
        await navigator.share({
          title: hotel?.name,
          text: hotel?.description,
          url: refLink
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (hotel?.map_link) {
      window.open(hotel.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${hotel?.name}, ${hotel?.location}, ${hotel?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };
  
  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!hotel) return;
    setIsProcessing(true);
    
    try {
      const totalAmount = data.selectedFacilities.reduce((sum, f) => { 
        if (f.startDate && f.endDate) {
          // Calculate number of full days booked (minimum 1 day)
          const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + (f.price * Math.max(days, 1));
        }
        return sum + f.price; // Fallback if dates are somehow missing
      }, 0) +
      data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
      const totalPeople = data.num_adults + data.num_children;

      await submitBooking({
        itemId: hotel.id,
        itemName: hotel.name,
        bookingType: 'hotel',
        totalAmount,
        slotsBooked: totalPeople,
        visitDate: data.visit_date,
        guestName: data.guest_name,
        guestEmail: data.guest_email,
        guestPhone: data.guest_phone,
        hostId: hotel.created_by,
        bookingDetails: {
          hotel_name: hotel.name,
          adults: data.num_adults,
          children: data.num_children,
          facilities: data.selectedFacilities,
          activities: data.selectedActivities
        }
      });
      
      setIsProcessing(false);
      setIsCompleted(true);
      toast({ title: "Booking Submitted", description: "Your booking has been saved. Check your email for confirmation." });
    } catch (error: any) {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };
  
  if (loading || !hotel) {
    return <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6"><div className="h-96 bg-muted animate-pulse rounded-lg" /></div>
        <MobileBottomBar />
      </div>;
  }
  
  const displayImages = [hotel.image_url, ...(hotel.gallery_images || []), ...(hotel.images || [])].filter(Boolean);
  
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-6xl mx-auto py-6 sm:py-4 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 sm:mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          {/* --- Image Carousel Section --- */}
          <div className="w-full relative">
            <Carousel opts={{
              loop: true
            }} plugins={[Autoplay({
              delay: 3000
            })]} className="w-full rounded-2xl overflow-hidden" setApi={api => {
              if (api) api.on("select", () => setCurrent(api.selectedScrollSnap()));
            }}>
              <CarouselContent>
                {displayImages.map((img, idx) => <CarouselItem key={idx}>
                    <img src={img} alt={`${hotel.name} ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" />
                  </CarouselItem>)}
              </CarouselContent>
              {displayImages.length > 1 && <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              }
            </Carousel>
            
            {/* START: Description Section with slide-down and border radius */}
            {hotel.description && 
              <div 
                className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 sm:p-2 z-10 
                           rounded-b-2xl 
                           shadow-lg 
                           transform translate-y-2" // Slide down effect
              >
                <h2 className="text-lg sm:text-base font-semibold mb-2">About This Hotel</h2>
                <p className="text-sm line-clamp-3">{hotel.description}</p>
              </div>
            }
            {/* END: Description Section */}
          </div>

          {/* --- Detail/Booking Section (Right Column on large screens, Stacked on small) --- */}
          <div className="space-y-4 sm:space-y-3">
            <div>
              <h1 className="text-3xl sm:text-2xl font-bold mb-2">{hotel.name}</h1>
              {hotel.local_name && (
                <p className="text-lg sm:text-base text-muted-foreground mb-2">"{hotel.local_name}"</p>
              )}
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {/* MapPin Icon Teal */}
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span className="sm:text-sm">{hotel.location}, {hotel.country}</span>
                {distance !== undefined && (
                  <span className="text-xs font-medium ml-auto" style={{ color: TEAL_COLOR }}>
                    {distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}
                  </span>
                )}
              </div>
              {hotel.place && (
                <p className="text-sm text-muted-foreground mb-4 sm:mb-2">Place: {hotel.place}</p>
              )}
            </div>

            {/* Operating Hours/Availability Card */}
            <div className="p-4 sm:p-3 border bg-card mb-4 sm:mb-2" style={{ borderColor: TEAL_COLOR }}>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm sm:text-xs text-muted-foreground">Working Hours & Days</p>
                  <p className="font-semibold sm:text-sm">
                    {(hotel.opening_hours || hotel.closing_hours) 
                      ? `${hotel.opening_hours || 'N/A'} - ${hotel.closing_hours || 'N/A'}`
                      : 'Not specified'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Working Days:</span>{' '}
                    {hotel.days_opened && hotel.days_opened.length > 0 
                      ? hotel.days_opened.join(', ')
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Book Now Button Teal and dark hover */}
              <Button 
                size="lg" 
                className="w-full text-white h-10 sm:h-9" 
                onClick={() => { setIsCompleted(false); setBookingOpen(true); }}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                Book Now
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Map Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openInMaps} 
                className="flex-1 h-9" 
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <MapPin className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Map</span>
              </Button>
              {/* Copy Link Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Copy className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Copy Link</span>
              </Button>
              {/* Share Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Share2 className="h-4 w-4 md:mr-2" style={{ color: TEAL_COLOR }} />
                <span className="hidden md:inline">Share</span>
              </Button>
              {/* Save Button: Border/Icon Teal (and filled red if saved) */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleSave} 
                className={`h-9 w-9 ${isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}`}
                style={{ borderColor: TEAL_COLOR, color: isSaved ? 'white' : TEAL_COLOR }}
              >
                <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* --- Amenities Section --- */}
        {hotel.amenities && hotel.amenities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Amenities</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.amenities.map((amenity, idx) => 
                // Amenities Badge Red
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs"
                  style={{ backgroundColor: RED_COLOR }}
                >
                  {amenity}
                </div>)}
            </div>
          </div>}

        {/* --- Facilities (Room Types) Section --- */}
        {hotel.facilities && hotel.facilities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Facilities (Room Types)</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.facilities.map((facility, idx) => 
                // Facilities Badge Teal
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1"
                  style={{ backgroundColor: TEAL_COLOR }}
                >
                  <span className="font-medium">{facility.name}</span>
                  <span className="text-xs opacity-90">{facility.price === 0 ? 'Free' : `KSh ${facility.price}/day`}</span>
                  {facility.capacity > 0 && <span className="text-xs opacity-90">• Capacity: {facility.capacity}</span>}
                </div>)}
            </div>
          </div>}

        {/* --- Activities Section --- */}
        {hotel.activities && hotel.activities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Activities</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.activities.map((activity, idx) => 
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1"
                  style={{ backgroundColor: ORANGE_COLOR }}
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                </div>)}
            </div>
          </div>}

        {/* --- Contact Information Section --- */}
        {(hotel.phone_numbers || hotel.email) && <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Contact Information</h2>
            <div className="space-y-2 sm:space-y-1">
              {hotel.phone_numbers?.map((phone, idx) => 
                <p key={idx} className="flex items-center gap-2 sm:text-sm">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  <a href={`tel:${phone}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{phone}</a>
                </p>)}
              {hotel.email && <p className="flex items-center gap-2 sm:text-sm">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  <a href={`mailto:${hotel.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{hotel.email}</a>
                </p>}
            </div>
          </div>}

        {/* --- Review Section --- */}
        <div className="mt-6 sm:mt-4">
          <ReviewSection itemId={hotel.id} itemType="hotel" />
        </div>

        {/* --- Similar Items Section --- */}
        {hotel && <SimilarItems currentItemId={hotel.id} itemType="hotel" country={hotel.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            facilities={hotel.facilities || []} 
            activities={hotel.activities || []} 
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={hotel.name}
            itemId={hotel.id}
            bookingType="hotel"
            hostId={hotel.created_by || ""}
            onPaymentSuccess={() => setIsCompleted(true)}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>;
};
export default HotelDetail;