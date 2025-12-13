import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, Clock, ArrowLeft, Heart, Copy } from "lucide-react";
import { SimilarItems } from "@/components/SimilarItems";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";

// Define the specific colors
const TEAL_COLOR = "#008080"; // Icons, Links, Book Button, and now FACILITIES
const RED_COLOR = "#FF0000"; // New color for AMENITIES, now also for Entry Fee price
const ORANGE_COLOR = "#FF9800"; // Activities

interface Facility { name: string; price: number; capacity?: number; }
interface Activity { name: string; price: number; }

interface AdventurePlace {
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
  entry_fee: number;
  entry_fee_type: string;
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  amenities: string[];
  registration_number: string;
  map_link: string;
  opening_hours: string | null;
  closing_hours: string | null;
  days_opened: string[] | null;
  available_slots: number;
  created_by: string;
  latitude: number | null;
  longitude: number | null;
}

const AdventurePlaceDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { position } = useGeolocation();
  const [place, setPlace] = useState<AdventurePlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isSaved = savedItems.has(id || "");

  // Calculate distance if position and place coordinates available
  const distance = position && place?.latitude && place?.longitude
    ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude)
    : undefined;

  useEffect(() => { 
    fetchPlace(); 
    
    // Track referral clicks
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "adventure_place", "booking");
    }
  }, [id]);

  const fetchPlace = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from("adventure_places").select("*").eq("id", id).single();
      
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase
          .from("adventure_places")
          .select("*")
          .ilike("id", `${id}%`)
          .single();
        if (!prefixError) {
          data = prefixData;
          error = null;
        }
      }
      
      if (error) throw error;
      setPlace(data as any);
    } catch (error) {
      console.error("Error fetching adventure place:", error);
      toast({ title: "Error", description: "Failed to load place details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => { if (id) handleSaveItem(id, "adventure_place"); };

  const handleCopyLink = async () => {
    if (!place) {
      toast({ title: "Unable to Copy", description: "Place information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(place.id, "adventure_place", place.id);

    try {
      await navigator.clipboard.writeText(refLink);
      toast({ 
        title: "Link Copied!", 
        description: user 
          ? "Share this link to earn commission on bookings!" 
          : "Share this place with others!" 
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
    if (!place) {
      toast({ title: "Unable to Share", description: "Place information not available", variant: "destructive" });
      return;
    }

    const refLink = await generateReferralLink(place.id, "adventure_place", place.id);

    if (navigator.share) {
      try { 
        await navigator.share({ title: place?.name, text: place?.description, url: refLink }); 
      } catch (error) { 
        console.log("Share failed:", error); 
      }
    } else {
      await handleCopyLink();
    }
  };

  const openInMaps = () => {
    if (place?.map_link) {
      window.open(place.map_link, '_blank');
    } else {
      const query = encodeURIComponent(`${place?.name}, ${place?.location}, ${place?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!place) return;
    setIsProcessing(true);

    try {
      const totalAmount = (data.num_adults * (place.entry_fee_type === 'free' ? 0 : place.entry_fee)) +
                         (data.num_children * (place.entry_fee_type === 'free' ? 0 : place.entry_fee)) +
                         data.selectedFacilities.reduce((sum, f) => { 
                           if (f.startDate && f.endDate) {
                             const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24));
                             return sum + (f.price * Math.max(days, 1));
                           }
                           return sum + f.price;
                         }, 0) +
                         data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
      const totalPeople = data.num_adults + data.num_children;

      await submitBooking({
        itemId: place.id,
        itemName: place.name,
        bookingType: 'adventure_place',
        totalAmount,
        slotsBooked: totalPeople,
        visitDate: data.visit_date,
        guestName: data.guest_name,
        guestEmail: data.guest_email,
        guestPhone: data.guest_phone,
        hostId: place.created_by,
        bookingDetails: {
          place_name: place.name,
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
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  if (loading || !place) return <div className="min-h-screen bg-background"><Header /><div className="h-96 bg-muted animate-pulse" /><MobileBottomBar /></div>;

  const displayImages = [place.image_url, ...(place.gallery_images || []), ...(place.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container px-4 py-6 sm:py-4 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 sm:mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        
        <div className="grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          <div className="w-full relative">
            <Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 3000 })]} className="w-full rounded-2xl overflow-hidden">
              <CarouselContent>
                {displayImages.map((img, idx) => <CarouselItem key={idx}><img src={img} alt={`${place.name} ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" /></CarouselItem>)}
              </CarouselContent>
              {displayImages.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                  <CarouselNext className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" />
                </>
              )}
            </Carousel>
            
            {/* START: Description Section with slide-down effect and border radius */}
            {place.description && (
              <div 
                className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 sm:p-3 z-10 
                           rounded-b-2xl 
                           shadow-lg 
                           transform translate-y-2" // The key styling for the "slide down" effect
              >
                <h2 className="text-lg sm:text-base font-semibold mb-2 sm:mb-1">About This Place</h2>
                <p className="text-sm line-clamp-3">{place.description}</p>
              </div>
            )}
            {/* END: Description Section */}
          </div>
          
          <div className="space-y-4 sm:space-y-3">
            <div>
              <h1 className="text-3xl sm:text-2xl font-bold mb-2">{place.name}</h1>
              {place.local_name && (
                <p className="text-lg sm:text-base text-muted-foreground mb-2">"{place.local_name}"</p>
              )}
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                {/* Location Icon Teal */}
                <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                <span className="sm:text-sm">{place.location}, {place.country}</span>
                {distance !== undefined && (
                  <span className="text-xs font-medium ml-auto" style={{ color: TEAL_COLOR }}>
                    {distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}
                  </span>
                )}
              </div>
              {place.place && (
                <p className="text-sm sm:text-xs text-muted-foreground mb-4 sm:mb-2">Place: {place.place}</p>
              )}
            </div>

            <div className="space-y-3 p-4 sm:p-3 border bg-card">
              {(place.opening_hours || place.closing_hours) && (
                <div className="flex items-center gap-2">
                  {/* Clock Icon Teal */}
                  <Clock className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                  <div>
                    <p className="text-sm sm:text-xs text-muted-foreground">Operating Hours</p>
                    <p className="font-semibold sm:text-sm">{place.opening_hours} - {place.closing_hours}</p>
                    {place.days_opened && place.days_opened.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{place.days_opened.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className={`${place.opening_hours || place.closing_hours ? 'border-t pt-3 sm:pt-2' : ''}`}>
                <p className="text-sm sm:text-xs text-muted-foreground mb-1">Entry Fee</p>
                <p 
                  className="text-2xl sm:text-xl font-bold"
                  style={{ color: RED_COLOR }} // **Applied red color here**
                >
                  {place.entry_fee_type === 'free' ? 'Free Entry' : 
                   place.entry_fee ? `KSh ${place.entry_fee}` : 'Contact for pricing'}
                </p>
                {place.available_slots !== null && place.available_slots !== undefined && (
                   <p className="text-sm sm:text-xs text-muted-foreground mt-2 sm:mt-1">Available Slots: {place.available_slots}</p>
                )}
              </div>

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

        {/* --- Amenities Section (RED) --- */}
        {place.amenities && place.amenities.length > 0 && (
          <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Amenities</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {place.amenities.map((amenity: any, idx: number) => (
                // Amenities Badge RED
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-primary-foreground rounded-full text-sm sm:text-xs"
                  style={{ backgroundColor: RED_COLOR }} 
                >
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Facilities Section (TEAL) --- */}
        {place.facilities && place.facilities.length > 0 && (
          <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Facilities (Rentable Spaces)</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {place.facilities.map((facility: Facility, idx: number) => (
                // Facilities Badge TEAL
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-primary-foreground rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1"
                  style={{ backgroundColor: TEAL_COLOR }} 
                >
                  <span className="font-medium">{facility.name}</span>
                  <span className="text-xs opacity-90">{facility.price === 0 ? 'Free' : `KSh ${facility.price}/day`}</span>
                  {facility.capacity && <span className="text-xs opacity-90">• Capacity: {facility.capacity}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Activities Section (ORANGE) --- */}
        {place.activities && place.activities.length > 0 && (
          <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-2">Activities (Bookable Experiences)</h2>
            <div className="flex flex-wrap gap-2 sm:gap-1">
              {place.activities.map((activity: Activity, idx: number) => (
                // Activities Badge Orange
                <div 
                  key={idx} 
                  className="px-4 py-2 sm:px-3 sm:py-1 text-primary-foreground rounded-full text-sm sm:text-xs flex items-center gap-2 sm:gap-1"
                  style={{ backgroundColor: ORANGE_COLOR }}
                >
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">{activity.price === 0 ? 'Free' : `KSh ${activity.price}/person`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Contact Information Section --- */}
        {(place.phone_numbers || place.email) && (
          <div className="mt-6 sm:mt-4 p-6 sm:p-3 border bg-card">
            <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Contact Information</h2>
            <div className="space-y-2 sm:space-y-1">
              {place.phone_numbers?.map((phone, idx) => (
                <p key={idx} className="flex items-center gap-2 sm:text-sm">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Phone Link Teal */}
                  <a href={`tel:${phone}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{phone}</a>
                </p>
              ))}
              {place.email && (
                <p className="flex items-center gap-2 sm:text-sm">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                  {/* Mail Link Teal */}
                  <a href={`mailto:${place.email}`} className="hover:underline" style={{ color: TEAL_COLOR }}>{place.email}</a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* --- Review Section --- */}
        <div className="mt-6 sm:mt-4">
          <ReviewSection itemId={place.id} itemType="adventure_place" />
        </div>

        {/* --- Similar Items Section --- */}
        {place && <SimilarItems currentItemId={place.id} itemType="adventure" country={place.country} />}
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} 
            facilities={place.facilities || []} 
            activities={place.activities || []} 
            priceAdult={place.entry_fee_type === 'free' ? 0 : place.entry_fee} 
            priceChild={place.entry_fee_type === 'free' ? 0 : place.entry_fee} 
            entranceType={place.entry_fee_type} 
            isProcessing={isProcessing} 
            isCompleted={isCompleted} 
            itemName={place.name}
            itemId={place.id}
            bookingType="adventure_place"
            hostId={place.created_by || ""}
            onPaymentSuccess={() => setIsCompleted(true)}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

export default AdventurePlaceDetail;