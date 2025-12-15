import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
// The Badge component itself is not directly used, but the logic is applied to divs
// import { Badge } from "@/components/ui/badge"; 
// Icons will be Teal: #008080
import { MapPin, Phone, Share2, Mail, Calendar, Clock, ArrowLeft, Heart, Copy, LocateFixed } from "lucide-react"; 
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
  // Added startDate and endDate for booking logic access
  startDate?: string;
  endDate?: string; 
}
interface Activity {
  name: string;
  price: number;
  // Added numberOfPeople for booking logic access
  numberOfPeople?: number; 
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
  const { position, requestLocation } = useGeolocation();
  
  // Request location on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestLocation();
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
    // Only request location if not already granted and is needed
    if (!position) {
        window.addEventListener('scroll', handleInteraction, { once: true });
        window.addEventListener('click', handleInteraction, { once: true });
    }

    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [position, requestLocation]);

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

    // Use hotel.id as the referrerId for simplicity/consistency
    const refLink = await generateReferralLink(hotel.id, "hotel", user?.id || hotel.id);

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

    // Use hotel.id as the referrerId for simplicity/consistency
    const refLink = await generateReferralLink(hotel.id, "hotel", user?.id || hotel.id);

    if (navigator.share) {
      try {
        await navigator.share({
          title: hotel?.name,
          text: `Check out this amazing place: ${hotel?.name} - ${hotel?.description.substring(0, 100)}...`,
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
    } else if (hotel?.latitude && hotel?.longitude) {
      // Use coordinates if available
      window.open(`https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`, '_blank');
    } else {
      const query = encodeURIComponent(`${hotel?.name}, ${hotel?.location}, ${hotel?.country}`);
      window.open(`https://www.google.com/maps/search/${query}`, '_blank');
    }
  };
  
  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!hotel) return;
    setIsProcessing(true);
    
    try {
      const totalAmount = data.selectedFacilities.reduce((sum, f) => { 
        if (f.startDate && f.endDate) {
          // Calculate number of full days booked (minimum 1 day). f.price is per day.
          const start = new Date(f.startDate).getTime();
          const end = new Date(f.endDate).getTime();
          // Calculate days difference (inclusive of start, exclusive of end by default for hotel stays)
          // To be safer, let's calculate full 24-hour periods.
          const daysRaw = (end - start) / (1000 * 60 * 60 * 24);
          const days = Math.max(1, Math.ceil(daysRaw)); // Minimum 1 day charge
          
          return sum + (f.price * days);
        }
        return sum + f.price; // Fallback if dates are somehow missing (e.g., if price is flat rate)
      }, 0) +
      data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
      
      const totalPeople = data.num_adults + data.num_children;
      const visitDate = data.selectedFacilities.find(f => f.startDate)?.startDate || data.visit_date; // Use first facility start date or fallback

      await submitBooking({
        itemId: hotel.id,
        itemName: hotel.name,
        bookingType: 'hotel',
        totalAmount,
        slotsBooked: totalPeople,
        visitDate: visitDate,
        guestName: data.guest_name,
        guestEmail: data.guest_email,
        guestPhone: data.guest_phone,
        hostId: hotel.created_by,
        bookingDetails: {
          hotel_name: hotel.name,
          adults: data.num_adults,
          children: data.num_children,
          facilities: data.selectedFacilities.map(({ name, price, startDate, endDate, capacity }) => ({ name, price, startDate, endDate, capacity })),
          activities: data.selectedActivities.map(({ name, price, numberOfPeople }) => ({ name, price, numberOfPeople }))
        }
      });
      
      setIsProcessing(false);
      setIsCompleted(true);
      toast({ title: "Booking Submitted", description: "Your booking has been saved. Check your email for confirmation." });
    } catch (error: any) {
      console.error("Booking submission error:", error);
      toast({
        title: "Booking failed",
        description: error.message || "An unexpected error occurred during booking.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };
  
  if (loading) {
    return <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6">
            <div className="flex items-center mb-4"><div className="h-4 w-16 bg-muted animate-pulse rounded mr-2" /></div>
            <div className="grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
              <div className="w-full h-64 md:h-96 bg-muted animate-pulse rounded-2xl" />
              <div className="space-y-4">
                  <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
            </div>
        </div>
        <MobileBottomBar />
      </div>;
  }
  
  const displayImages = [hotel.image_url, ...(hotel.gallery_images || []), ...(hotel.images || [])].filter(Boolean);
  
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-6xl mx-auto py-6 sm:py-4 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 sm:mb-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          {/* --- Image Carousel Section --- */}
          <div className="w-full relative">
            <Carousel opts={{
              loop: true
            }} plugins={[Autoplay({
              delay: 3000,
              stopOnInteraction: true
            })]} className="w-full rounded-2xl overflow-hidden" setApi={api => {
              if (api) api.on("select", () => setCurrent(api.selectedScrollSnap()));
            }}>
              <CarouselContent>
                {displayImages.map((img, idx) => <CarouselItem key={idx}>
                    <img 
                      src={img} 
                      alt={`${hotel.name} ${idx + 1}`} 
                      loading="lazy" 
                      decoding="async" 
                      className="w-full h-64 md:h-96 object-cover aspect-video" 
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => e.currentTarget.src = 'placeholder-image.jpg'} // Simple error handling
                    />
                  </CarouselItem>)}
              </CarouselContent>
              {displayImages.length > 1 && <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              }
              {displayImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                    {displayImages.map((_, index) => (
                        <div key={index} 
                             className={`h-2 rounded-full transition-all duration-300 ${current === index ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                             aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
              )}
            </Carousel>
            
            {/* START: Description Section with slide-down and border radius */}
            {hotel.description && 
              <div 
                className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 sm:p-3 z-10 
                           rounded-b-2xl 
                           shadow-lg 
                           transition-all duration-300 hover:bg-black/80" // Increased contrast and hover effect
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
                  <div className="flex items-center gap-1 ml-auto text-xs font-medium" style={{ color: TEAL_COLOR }}>
                    <LocateFixed className="h-3 w-3" style={{ color: TEAL_COLOR }} />
                    {distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}
                  </div>
                )}
              </div>
              {hotel.establishment_type && (
                <Badge className="mb-4 sm:mb-2 text-xs" style={{ backgroundColor: TEAL_COLOR }}>{hotel.establishment_type}</Badge>
              )}
            </div>

            {/* Operating Hours Card */}
            <div className="p-4 sm:p-3 border bg-card rounded-lg shadow-sm" style={{ borderColor: TEAL_COLOR }}>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 flex-shrink-0" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm sm:text-xs text-muted-foreground font-medium">Working Hours & Days</p>
                  <p className="font-semibold sm:text-sm">
                    <Calendar className="h-4 w-4 inline mr-1 align-sub" style={{ color: TEAL_COLOR }} />
                    <span className="text-sm text-muted-foreground font-normal mr-2">Open:</span>
                    {(hotel.opening_hours || hotel.closing_hours) 
                      ? `${hotel.opening_hours || 'N/A'} - ${hotel.closing_hours || 'N/A'}`
                      : 'Not specified'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Days:</span>{' '}
                    {hotel.days_opened && hotel.days_opened.length > 0 
                      ? hotel.days_opened.join(', ')
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {/* Book Now Button Teal and dark hover */}
              <Button 
                size="lg" 
                className="w-full text-white h-11 text-base font-semibold transition-all duration-200" 
                onClick={() => { setIsCompleted(false); setBookingOpen(true); }}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                Book Now
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 flex-wrap">
              {/* Map Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openInMaps} 
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 h-9 transition-colors duration-200" 
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TEAL_COLOR}10`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <MapPin className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Map</span>
              </Button>
              {/* Copy Link Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink} 
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 h-9 transition-colors duration-200"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TEAL_COLOR}10`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Copy className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Copy Link</span>
              </Button>
              {/* Share Button: Border/Icon Teal */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare} 
                className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 h-9 transition-colors duration-200"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TEAL_COLOR}10`)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Share2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Share</span>
              </Button>
              {/* Save Button: Border/Icon Teal (and filled red if saved) */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleSave} 
                className={`h-9 w-9 flex-shrink-0 transition-colors duration-200 ${isSaved ? "bg-red-500 text-white hover:bg-red-600 border-red-500 hover:border-red-600" : ""}`}
                style={{ borderColor: isSaved ? RED_COLOR : TEAL_COLOR, color: isSaved ? 'white' : TEAL_COLOR, backgroundColor: isSaved ? RED_COLOR : 'transparent' }}
                onMouseEnter={(e) => !isSaved && (e.currentTarget.style.backgroundColor = `${TEAL_COLOR}10`)}
                onMouseLeave={(e) => !isSaved && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* --- Amenities Section --- */}
        {hotel.amenities && hotel.amenities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-4 border bg-card rounded-xl shadow-md">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Amenities</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.amenities.map((amenity, idx) => 
                // Amenities Badge Red
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs font-medium shadow-sm"
                  style={{ backgroundColor: RED_COLOR }}
                >
                  {amenity}
                </div>)}
            </div>
          </div>}

        {/* --- Facilities (Room Types) Section --- */}
        {hotel.facilities && hotel.facilities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-4 border bg-card rounded-xl shadow-md">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Facilities (Room Types)</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.facilities.map((facility, idx) => 
                // Facilities Badge Teal
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1 font-medium shadow-sm"
                  style={{ backgroundColor: TEAL_COLOR }}
                >
                  <span className="font-semibold">{facility.name}</span>
                  <span className="text-xs opacity-90">•</span>
                  <span className="text-xs opacity-90">{facility.price === 0 ? 'Free' : `KSh ${facility.price}/day`}</span>
                  {facility.capacity > 0 && 
                    <>
                      <span className="text-xs opacity-90">•</span>
                      <span className="text-xs opacity-90">Capacity: {facility.capacity}</span>
                    </>
                  }
                </div>)}
            </div>
          </div>}

        {/* --- Activities Section --- */}
        {hotel.activities && hotel.activities.length > 0 && <div className="mt-6 sm:mt-4 p-6 sm:p-4 border bg-card rounded-xl shadow-md">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Activities</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {hotel.activities.map((activity, idx) => 
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-white rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1 font-medium shadow-sm"
                  style={{ backgroundColor: ORANGE_COLOR }}
                >
                  <span className="font-semibold">{activity.name}</span>
                  <span className="text-xs opacity-90">•</span>
                  <span className="text-xs opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                </div>)}
            </div>
          </div>}

        {/* --- Contact Information Section --- */}
        {(hotel.phone_numbers?.length > 0 || hotel.email) && <div className="mt-6 sm:mt-4 p-6 sm:p-4 border bg-card rounded-xl shadow-md">
            <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Contact Information</h2>
            <div className="space-y-2 sm:space-y-1">
              {hotel.phone_numbers?.map((phone, idx) => 
                <p key={idx} className="flex items-center gap-2 sm:text-sm">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4 flex-shrink-0" style={{ color: TEAL_COLOR }} />
                  <a href={`tel:${phone}`} className="hover:underline text-primary" style={{ color: TEAL_COLOR }}>{phone}</a>
                </p>)}
              {hotel.email && <p className="flex items-center gap-2 sm:text-sm">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4 flex-shrink-0" style={{ color: TEAL_COLOR }} />
                  <a href={`mailto:${hotel.email}`} className="hover:underline text-primary" style={{ color: TEAL_COLOR }}>{hotel.email}</a>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 sm:p-6">
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
            onPaymentSuccess={() => { setIsCompleted(true); /* navigate('/success-page') */ }}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>;
};
export default HotelDetail;