import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Icons will be Teal: #008080
import { MapPin, Phone, Share2, Mail, Clock, ArrowLeft, Heart, Copy } from "lucide-react"; 
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
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
  const { position, requestLocation } = useGeolocation();
  
  // Request location on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestLocation();
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('scroll', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [requestLocation]);
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
      // Fixed the URL to be a standard Google Maps URL
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
        <Header className="hidden md:block" />
        <div className="h-96 bg-muted animate-pulse" />
        <MobileBottomBar />
      </div>;
  }
  
  const displayImages = [hotel.image_url, ...(hotel.gallery_images || []), ...(hotel.images || [])].filter(Boolean);
  
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header hidden on small screen / PWA mode */}
      <Header className="hidden md:block" /> 
      
      {/* FULL-WIDTH SLIDESHOW SECTION: Mobile-first full width, desktop contained max-w */}
      <div className="relative w-full overflow-hidden md:max-w-6xl md:mx-auto">
        
        {/* Back Button: Top Left, Dark RGBA */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="absolute top-4 left-4 z-30 h-10 w-10 p-0 rounded-full text-white md:left-8" // Increased Z-index and adjusted md:left
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} // Dark RGBA
          size="icon"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Save Button: Top Right, Dark RGBA/Red filled */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSave} 
          className={`absolute top-4 right-4 z-30 h-10 w-10 p-0 rounded-full text-white md:right-8 ${isSaved ? "bg-red-500 hover:bg-red-600" : ""}`}
          style={{ backgroundColor: isSaved ? RED_COLOR : 'rgba(0, 0, 0, 0.5)' }} // Dark RGBA or RED if saved
        >
          <Heart className={`h-5 w-5 ${isSaved ? "fill-white" : ""}`} />
        </Button>

        <Carousel 
          opts={{ loop: true }} 
          plugins={[Autoplay({ delay: 3000 })]} 
          className="w-full overflow-hidden"
          style={{ 
            borderBottom: `2px solid ${TEAL_COLOR}`, // Teal bottom border for small/big screen
            marginTop: 0, 
            width: '100%', 
            maxHeight: '600px' // Added max height for larger screens
          }}
          setApi={(api) => {
            if (api) api.on("select", () => setCurrent(api.selectedScrollSnap()));
          }}
        >
          <CarouselContent>
            {displayImages.map((img, idx) => (
              <CarouselItem key={idx}>
                <img 
                  src={img} 
                  alt={`${hotel.name} ${idx + 1}`} 
                  loading="lazy" 
                  decoding="async" 
                  className="w-full h-[60vh] md:h-96 lg:h-[500px] object-cover" // Ensure height consistency
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Name Overlay: Fading RGBA, concentrated at center bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-20 text-white bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          {/* MODIFIED: make the item name bold and capital always and remove the name that appear below the item name */}
          <h1 className="text-3xl sm:text-2xl font-bold mb-0 uppercase">{hotel.name}</h1>
          {/* REMOVED: hotel.local_name logic */}
        </div>
        
        {/* Dot indicators */}
        {/* MODIFIED: The dot image should be on the right bottom. */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-30">
            {displayImages.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2 h-2 rounded-full transition-all ${current === idx ? 'bg-white w-4' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Main Content starts here, contained by the max-width wrapper */}
      <main className="container px-4 max-w-6xl mx-auto mt-4 sm:mt-6">
        {/* The overall structure now uses flex-col for small screens to enforce the order, 
            and grid for large screens. */}
        <div className="flex flex-col lg:grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          
          {/* Mobile Order 1: Operating Hours/Availability/Booking Button (Small Screen) 
              This section is order-1 on small screens, and order-3 on large screens (making it the right column). */}
          <div className="space-y-4 sm:space-y-3 order-1 lg:order-3">
            
            {/* Operating Hours/Availability Card (Booking Card structure) */}
            <div className="space-y-3 p-4 sm:p-3 border bg-card rounded-lg">
              
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 mt-1" style={{ color: TEAL_COLOR }} />
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

              <div className="border-t pt-3 sm:pt-2">
               {/* The entire block for "Available Rooms" has been removed from here */}
                  <p className="text-xs text-muted-foreground mt-2 sm:mt-1">
                      Room prices vary by type/facilities selected
                  </p>
              </div>

              {/* Book Now Button */}
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
            
            {/* Contact Information Section (Always in the right column / bottom of mobile section) */}
            {(hotel.phone_numbers || hotel.email) && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg hidden lg:block"> {/* Hidden on small screen, visible on large */}
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Contact Information </h2>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-2">
                  {hotel.phone_numbers?.map((phone, idx) => (
                    <a 
                      key={idx} 
                      href={`tel:${phone}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{phone}</span>
                    </a>
                  ))}
                  {hotel.email && (
                    <a 
                      href={`mailto:${hotel.email}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{hotel.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* LEFT COLUMN (The sequentially ordered content) 
              This section is order-2 on small screens, and order-1 on large screens (making it the left column). 
              The internal order for mobile is enforced here. */}
          <div className="w-full space-y-4 order-2 lg:order-1">
            
            {/* Mobile Order 2: Location/Distance/Details section (Location link) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span className="sm:text-sm">{hotel.location}, {hotel.country}</span>
                {distance !== undefined && (
                  <span className="text-xs font-medium ml-auto" style={{ color: TEAL_COLOR }}>
                    {distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}
                  </span>
                )}
              </div>
              {hotel.place && (
                <p className="text-sm sm:text-xs text-muted-foreground mb-4 sm:mb-2">Place: {hotel.place}</p>
              )}
              
              {/* Mobile Order 3: Action Buttons (Share, Copy Link) */}
              <div className="flex gap-2">
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
              </div>
            </div>

            {/* Mobile Order 4: Description Section (About) */}
            {hotel.description && 
              <div className="bg-card border rounded-lg p-4 sm:p-3">
                <h2 className="text-lg sm:text-base font-semibold mb-2 sm:mb-1">About This Hotel</h2>
                <p className="text-sm text-muted-foreground">{hotel.description}</p>
              </div>
            }

            {/* Mobile Order 5: Amenities Section (RED) - Rounded Buttons */}
            {hotel.amenities && hotel.amenities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {hotel.amenities.map((amenity, idx) => (
                    <div 
                      key={idx} 
                      // --- ADDED rounded-full for 50% border-radius ---
                      className="px-3 py-2 text-white rounded-full text-sm flex items-center justify-center text-center min-h-[44px]"
                      style={{ backgroundColor: RED_COLOR }}
                    >
                      <span className="font-medium">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile Order 6: Facilities (Room Types) Section (TEAL) - Rounded Buttons */}
            {hotel.facilities && hotel.facilities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Facilities (Room Types)</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {hotel.facilities.map((facility, idx) => (
                    <div 
                      key={idx} 
                      // --- ADDED rounded-full for 50% border-radius ---
                      className="px-3 py-2 text-white rounded-full text-sm flex flex-col items-center justify-center text-center min-h-[60px] leading-tight"
                      style={{ backgroundColor: TEAL_COLOR }}
                    >
                      <span className="font-medium">{facility.name}</span>
                      <span className="text-xs opacity-90 mt-1">{facility.price === 0 ? 'Free' : `KSh ${facility.price}/day`}</span>
                      {facility.capacity > 0 && <span className="text-xs opacity-90">Capacity: {facility.capacity}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile Order 7: Activities Section (ORANGE) - Rounded Buttons */}
            {hotel.activities && hotel.activities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Activities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {hotel.activities.map((activity, idx) => (
                    <div 
                      key={idx} 
                      // --- ADDED rounded-full for 50% border-radius ---
                      className="px-3 py-2 text-white rounded-full text-sm flex flex-col items-center justify-center text-center min-h-[60px] leading-tight"
                      style={{ backgroundColor: ORANGE_COLOR }}
                    >
                      <span className="font-medium">{activity.name}</span>
                      <span className="text-xs opacity-90 mt-1">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Contact Information Section (Always in the right column / bottom of mobile section) */}
            {(hotel.phone_numbers || hotel.email) && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg lg:hidden"> {/* Visible on small screen, hidden on large */}
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-2">
                  {hotel.phone_numbers?.map((phone, idx) => (
                    <a 
                      key={idx} 
                      href={`tel:${phone}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{phone}</span>
                    </a>
                  ))}
                  {hotel.email && (
                    <a 
                      href={`mailto:${hotel.email}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{hotel.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Order 8: Review Section (Rating) */}
        <div className="mt-6 sm:mt-4">
          <ReviewSection itemId={hotel.id} itemType="hotel" />
        </div>

        {/* Similar Items Section */}
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
    </div>
  );
};
export default HotelDetail;