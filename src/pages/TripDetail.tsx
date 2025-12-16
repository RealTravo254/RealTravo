import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

// Assume these imports are from the original file context
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, ArrowLeft, Heart, Copy, Calendar } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";

// Define the specific colors (ensure these are defined in the file context)
const TEAL_COLOR = "#008080"; // Icons, Links, Book Button, Facilities, Carousel Border
const RED_COLOR = "#FF0000"; // Amenities, Entry Fee price
const ORANGE_COLOR = "#FF9800"; // Activities

interface Activity { name: string; price: number; }

interface Trip {
  id: string;
  name: string;
  location: string;
  country: string;
  image_url: string;
  images: string[];
  gallery_images: string[];
  description: string;
  price: number;
  price_child: number;
  phone_number: string | null;
  email: string | null;
  activities: Activity[];
  available_tickets: number;
  date: string;
  is_custom_date: boolean;
  registration_number: string | null;
  map_link: string | null;
  created_by: string;
}

const TripDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isSaved = savedItems.has(id || "");

  useEffect(() => { 
    fetchTrip(); 
    
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "trip", "booking");
    }
  }, [id]);

  const fetchTrip = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
      
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase
          .from("trips")
          .select("*")
          .ilike("id", `${id}%`)
          .single();
        if (!prefixError) {
          data = prefixData;
          error = null;
        }
      }
      
      if (error) throw error;
      setTrip(data as any);
    } catch (error) {
      console.error("Error fetching trip:", error);
      toast({ title: "Error", description: "Failed to load trip details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => { if (id) handleSaveItem(id, "trip"); };

  const handleCopyLink = async () => {
    if (!trip) {
      toast({ title: "Unable to Copy", description: "Trip information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(trip.id, "trip", trip.id);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this trip with others!" 
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
    if (!trip) {
      toast({ title: "Unable to Share", description: "Trip information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(trip.id, "trip", trip.id);

    if (navigator.share) {
      try { 
        await navigator.share({ title: trip?.name, text: trip?.description, url: refLink }); 
      } catch (error) { 
        console.log("Share failed:", error); 
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (trip?.map_link) {
      window.open(trip.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${trip?.name}, ${trip?.location}, ${trip?.country}`);
      // NOTE: Using the correct Google Maps URL format
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!trip) return;
    setIsProcessing(true);

    try {
      const totalAmount = (data.num_adults * trip.price) + (data.num_children * trip.price_child);
      const slotsBooked = data.num_adults + data.num_children;

      await submitBooking({
        itemId: trip.id,
        itemName: trip.name,
        bookingType: 'trip',
        totalAmount,
        slotsBooked,
        visitDate: data.visit_date,
        guestName: data.guest_name,
        guestEmail: data.guest_email,
        guestPhone: data.guest_phone,
        hostId: trip.created_by,
        bookingDetails: {
          trip_name: trip.name,
          adults: data.num_adults,
          children: data.num_children,
        }
      });
      
      setIsProcessing(false);
      setIsCompleted(true);
      toast({ title: "Booking Submitted", description: "Your booking has been saved. Check your email for confirmation." });
    } catch (error: any) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header className="hidden md:block" />
        <div className="container px-4 py-6 max-w-6xl mx-auto">
          <div className="h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
        </div>
        <MobileBottomBar />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background">
        <Header className="hidden md:block" />
        <div className="container mx-auto px-4 py-8">
          <p>Trip not found</p>
        </div>
        <MobileBottomBar />
        </div>
    );
  }

  const displayImages = [trip.image_url, ...(trip.gallery_images || []), ...(trip.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header hidden on small screen / PWA mode */}
      <Header className="hidden md:block" /> 
      
      {/* FULL-WIDTH SLIDESHOW SECTION */}
      <div className="relative w-full overflow-hidden md:max-w-6xl md:mx-auto">
        {/* Back Button: Top Left, Dark RGBA */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="absolute top-4 left-4 z-30 h-10 w-10 p-0 rounded-full text-white md:left-8" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} 
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
          style={{ backgroundColor: isSaved ? RED_COLOR : 'rgba(0, 0, 0, 0.5)' }} 
        >
          <Heart className={`h-5 w-5 ${isSaved ? "fill-white" : ""}`} />
        </Button>

        {/* REMOVED: Badge for 'TRIP' */}
        {/*         <Badge className="absolute top-4 right-20 sm:top-4 sm:right-20 bg-primary text-primary-foreground z-30 text-xs font-bold px-3 py-1 rounded-full">
          TRIP
        </Badge>
        */}

        <Carousel 
          opts={{ loop: true }} 
          plugins={[Autoplay({ delay: 3000 })]} 
          className="w-full overflow-hidden"
          style={{ 
            borderBottom: `2px solid ${TEAL_COLOR}`,
            marginTop: 0, 
            width: '100%', 
            maxHeight: '600px' 
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
                  alt={`${trip.name} ${idx + 1}`} 
                  loading="lazy" 
                  decoding="async" 
                  className="w-full h-[60vh] md:h-96 lg:h-[500px] object-cover" 
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Name Overlay: Fading RGBA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-20 text-white bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          <h1 className="text-3xl sm:text-2xl font-bold mb-0">{trip.name.toUpperCase()}</h1> {/* <-- MODIFIED: .toUpperCase() added */}
        </div>
        
        {/* Dot indicators */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-30"> {/* <-- MODIFIED: right-4 added, center classes removed */}
            {displayImages.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2 h-2 rounded-full transition-all ${current === idx ? 'bg-white w-4' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Main Content starts here, optimized for small screen order */}
      <main className="container px-4 max-w-6xl mx-auto mt-4 sm:mt-6">
        <div className="grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          
          {/* --- 1. MOBILE FIRST: BOOKING CARD & ACTION BUTTONS --- (lg:order-2 for desktop) */}
          <div className="space-y-4 sm:space-y-3 lg:mt-0 lg:order-2"> 
            
            {/* Booking Card */}
            <div className="space-y-3 p-4 sm:p-3 border bg-card rounded-lg lg:sticky lg:top-20"> 
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm sm:text-xs text-muted-foreground">Trip Date</p>
                  <p className="font-semibold sm:text-sm">{trip.is_custom_date ? "Flexible" : new Date(trip.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t pt-3 sm:pt-2">
                <p className="text-sm sm:text-xs text-muted-foreground mb-1">Price (Per Adult)</p>
                <p className="text-2xl sm:text-xl font-bold" style={{ color: RED_COLOR }}>KSh {trip.price}</p>
                {trip.price_child > 0 && <p className="text-sm sm:text-xs text-muted-foreground">Child: KSh {trip.price_child}</p>}
                <p className="text-sm sm:text-xs text-muted-foreground mt-2 sm:mt-1">Available Tickets: {trip.available_tickets}</p>
              </div>

              {/* Book Now Button */}
              <Button 
                size="lg" 
                className="w-full text-white h-10 sm:h-9" 
                onClick={() => { setIsCompleted(false); setBookingOpen(true); }}
                disabled={trip.available_tickets <= 0}
                style={{ backgroundColor: TEAL_COLOR }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#005555')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = TEAL_COLOR)}
              >
                {trip.available_tickets <= 0 ? "Sold Out" : "Book Now"}
              </Button>
            </div>

            {/* Action Buttons (Map, Copy Link, Share) */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={openInMaps} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <MapPin className="h-4 w-4 mr-2" style={{ color: TEAL_COLOR }} />
                <span>Map</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Copy className="h-4 w-4 mr-2" style={{ color: TEAL_COLOR }} />
                <span>Copy Link</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare} 
                className="flex-1 h-9"
                style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}
              >
                <Share2 className="h-4 w-4 mr-2" style={{ color: TEAL_COLOR }} />
                <span>Share</span>
              </Button>
            </div>
            
          </div> {/* END Booking/Action Group */}

          {/* --- 2. LEFT COLUMN (Details) --- (lg:order-1 for desktop) */}
          <div className="w-full space-y-4 lg:order-1"> 
            
            {/* Location/Map Link Section (Hides location name on small screen) */}
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-4 sm:mb-2">
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                {/* Visible on medium/large screens */}
                <span className="sm:text-sm hidden md:inline">{trip.location}, {trip.country}</span>
                {/* Visible only on small screens */}
                <span 
                    className="sm:text-sm md:hidden text-sm cursor-pointer"
                    style={{ color: TEAL_COLOR }}
                    onClick={openInMaps}
                >
                    View on Map
                </span>
              </div>
            </div>

            {/* Description Section (ABOUT SECTION) */}
            {trip.description && (
              <div className="bg-card border rounded-lg p-4 sm:p-3">
                <h2 className="text-lg sm:text-base font-semibold mb-2 sm:mb-1">About This Trip</h2>
                <p className="text-sm text-muted-foreground">{trip.description}</p>
              </div>
            )}
            
            {/* Included Activities Section (ORANGE) */}
            {trip.activities && trip.activities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Included Activities</h2>
                <div className="flex flex-wrap gap-2">
                  {trip.activities.map((activity, idx) => (
                    <div 
                      key={idx} 
                      className="px-3 py-1.5 text-white rounded-full text-xs flex flex-col items-center justify-center text-center"
                      style={{ backgroundColor: ORANGE_COLOR }}
                    >
                      <span className="font-medium">{activity.name}</span>
                      <span className="text-[10px] opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Contact Information Section */}
            {(trip.phone_number || trip.email) && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {trip.phone_number && (
                    <a 
                      href={`tel:${trip.phone_number}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{trip.phone_number}</span>
                    </a>
                  )}
                  {trip.email && (
                    <a 
                      href={`mailto:${trip.email}`}
                      className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
                      style={{ borderColor: TEAL_COLOR }}
                    >
                      <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{trip.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* Review Section (Full Width) */}
            <div className="mt-6 sm:mt-4">
              <ReviewSection itemId={trip.id} itemType="trip" />
            </div>

          </div> {/* END LEFT COLUMN */}
        </div> {/* END GRID */}
        
        {/* --- Similar Items Section (Full Width, always last) --- */}
        {trip && <SimilarItems currentItemId={trip.id} itemType="trip" country={trip.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking
            onSubmit={handleBookingSubmit}
            activities={trip.activities || []}
            priceAdult={trip.price}
            priceChild={trip.price_child}
            isProcessing={isProcessing}
            isCompleted={isCompleted}
            itemName={trip.name}
            skipDateSelection={!trip.is_custom_date}
            fixedDate={trip.date}
            skipFacilitiesAndActivities={true} 
            itemId={trip.id}
            bookingType="trip"
            hostId={trip.created_by || ""}
            onPaymentSuccess={() => setIsCompleted(true)}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

export default TripDetail;