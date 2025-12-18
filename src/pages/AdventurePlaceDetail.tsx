import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Share2, Mail, Clock, ArrowLeft, Heart, Copy, CheckCircle2 } from "lucide-react";
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
  amenities: any;
  phone_numbers: string[];
  email: string;
  facilities: Facility[];
  activities: Activity[];
  opening_hours: string;
  closing_hours: string;
  days_opened: string[];
  registration_number: string;
  map_link: string;
  entry_fee: number;
  entry_fee_type: string;
  available_slots: number;
  created_by: string | null;
  latitude: number | null;
  longitude: number | null;
}

const TEAL_COLOR = "#008080";
const RED_COLOR = "#EF4444";

const AdventurePlaceDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { position, requestLocation } = useGeolocation();

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

  const [place, setPlace] = useState<AdventurePlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isSaved = savedItems.has(id || "");

  const distance = position && place?.latitude && place?.longitude
    ? calculateDistance(position.latitude, position.longitude, place.latitude, place.longitude)
    : undefined;

  useEffect(() => {
    fetchPlace();
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
      toast({
        title: "Error",
        description: "Failed to load details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (id) handleSaveItem(id, "adventure");
  };

  const handleCopyLink = async () => {
    if (!place) return;
    const refLink = await generateReferralLink(place.id, "adventure_place", place.id);
    try {
      await navigator.clipboard.writeText(refLink);
      toast({ title: "Link Copied!", description: user ? "Share this link to earn commission!" : "Share this place with others!" });
    } catch (error) {
      toast({ title: "Copy Failed", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!place) return;
    const refLink = await generateReferralLink(place.id, "adventure_place", place.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text: place.description, url: refLink });
      } catch (error) {}
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
      const facilityTotal = data.selectedFacilities.reduce((sum, f) => sum + f.price, 0);
      const activityTotal = data.selectedActivities.reduce((sum, a) => sum + (a.price * a.numberOfPeople), 0);
      const entryFee = (place.entry_fee || 0) * (data.num_adults + data.num_children);
      const totalAmount = facilityTotal + activityTotal + entryFee;
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
          activities: data.selectedActivities,
          entry_fee: place.entry_fee
        }
      });
      
      setIsProcessing(false);
      setIsCompleted(true);
      toast({ title: "Booking Submitted", description: "Check your email for confirmation." });
    } catch (error: any) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  if (loading || !place) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header className="hidden md:block" />
        <div className="h-96 bg-muted animate-pulse" />
        <MobileBottomBar />
      </div>
    );
  }

  const displayImages = [place.image_url, ...(place.gallery_images || []), ...(place.images || [])].filter(Boolean);
  const facilities = Array.isArray(place.facilities) ? place.facilities : [];
  const activities = Array.isArray(place.activities) ? place.activities : [];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header className="hidden md:block" />

      <div className="relative w-full overflow-hidden md:max-w-6xl md:mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-30 h-10 w-10 p-0 rounded-full text-white md:left-8"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          size="icon"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className={`absolute top-4 right-4 z-30 h-10 w-10 p-0 rounded-full text-white md:right-8 ${isSaved ? "bg-red-500 hover:bg-red-600" : ""}`}
          style={{ backgroundColor: isSaved ? RED_COLOR : 'rgba(0, 0, 0, 0.5)' }}
        >
          <Heart className={`h-5 w-5 ${isSaved ? "fill-white" : ""}`} />
        </Button>

        <Carousel
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 3000 })]}
          className="w-full overflow-hidden"
          style={{ borderBottom: `2px solid ${TEAL_COLOR}` }}
          setApi={(api) => {
            if (api) api.on("select", () => setCurrent(api.selectedScrollSnap()));
          }}
        >
          <CarouselContent>
            {displayImages.map((img, idx) => (
              <CarouselItem key={idx}>
                <img src={img} alt={`${place.name} ${idx + 1}`} loading="lazy" className="w-full h-[42vh] md:h-96 lg:h-[500px] object-cover" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-20 text-white bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          <Badge className="mb-2 bg-primary hover:bg-primary">Adventure Place</Badge>
          <h1 className="text-3xl sm:text-2xl font-bold mb-0 uppercase">{place.name}</h1>
          {distance !== undefined && (
            <p className="text-sm opacity-80 mt-1">{distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}</p>
          )}
        </div>

        {displayImages.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-30">
            {displayImages.map((_, idx) => (
              <div key={idx} className={`w-2 h-2 rounded-full transition-all ${current === idx ? 'bg-white w-4' : 'bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>

      <main className="container px-4 max-w-6xl mx-auto mt-4 sm:mt-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[2fr,1fr] gap-6 sm:gap-4">
          
          <div className="space-y-4 sm:space-y-3 order-1 lg:order-3">
            <div className="space-y-3 p-4 sm:p-3 border bg-card rounded-lg lg:sticky lg:top-20">
              {place.entry_fee !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entry Fee</span>
                  <span className="font-semibold" style={{ color: TEAL_COLOR }}>
                    {place.entry_fee === 0 ? "Free" : `KSh ${place.entry_fee}`}
                    {place.entry_fee_type && ` / ${place.entry_fee_type}`}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 mt-1" style={{ color: TEAL_COLOR }} />
                <div>
                  <p className="text-sm sm:text-xs text-muted-foreground">Working Hours & Days</p>
                  <p className="font-semibold sm:text-sm">
                    {(place.opening_hours || place.closing_hours)
                      ? `${place.opening_hours || 'N/A'} - ${place.closing_hours || 'N/A'}`
                      : 'Not specified'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Working Days:</span>{' '}
                    {place.days_opened?.length > 0 ? place.days_opened.join(', ') : 'Not specified'}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full text-white h-10 sm:h-9"
                onClick={() => { setIsCompleted(false); setBookingOpen(true); }}
                style={{ backgroundColor: TEAL_COLOR }}
              >
                Book Now
              </Button>
            </div>

            {(place.phone_numbers || place.email) && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg hidden lg:block">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Contact Information</h2>
                <div className="grid grid-cols-1 gap-2">
                  {place.phone_numbers?.map((phone, idx) => (
                    <a key={idx} href={`tel:${phone}`} className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors" style={{ borderColor: TEAL_COLOR }}>
                      <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{phone}</span>
                    </a>
                  ))}
                  {place.email && (
                    <a href={`mailto:${place.email}`} className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors" style={{ borderColor: TEAL_COLOR }}>
                      <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{place.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-3 order-2 lg:order-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
              <span className="text-sm">{place.location}, {place.country}</span>
            </div>

            {place.description && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">About</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{place.description}</p>
              </div>
            )}

            {facilities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Facilities</h2>
                <div className="grid grid-cols-2 gap-2">
                  {facilities.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${TEAL_COLOR}10` }}>
                      <CheckCircle2 className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm">{f.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {f.price === 0 ? "Free" : `KSh ${f.price}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activities.length > 0 && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg">
                <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Activities</h2>
                <div className="grid grid-cols-2 gap-2">
                  {activities.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: `${TEAL_COLOR}10` }}>
                      <CheckCircle2 className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {a.price === 0 ? "Free" : `KSh ${a.price}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" onClick={openInMaps} className="flex-col h-auto py-3" style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}>
                <MapPin className="h-5 w-5 mb-1" />
                <span className="text-xs">Map</span>
              </Button>
              <Button variant="outline" onClick={handleCopyLink} className="flex-col h-auto py-3" style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}>
                <Copy className="h-5 w-5 mb-1" />
                <span className="text-xs">Copy</span>
              </Button>
              <Button variant="outline" onClick={handleShare} className="flex-col h-auto py-3" style={{ borderColor: TEAL_COLOR, color: TEAL_COLOR }}>
                <Share2 className="h-5 w-5 mb-1" />
                <span className="text-xs">Share</span>
              </Button>
            </div>

            {(place.phone_numbers || place.email) && (
              <div className="p-4 sm:p-3 border bg-card rounded-lg lg:hidden">
                <h2 className="text-xl sm:text-lg font-semibold mb-4 sm:mb-3">Contact Information</h2>
                <div className="grid grid-cols-1 gap-2">
                  {place.phone_numbers?.map((phone, idx) => (
                    <a key={idx} href={`tel:${phone}`} className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors" style={{ borderColor: TEAL_COLOR }}>
                      <Phone className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{phone}</span>
                    </a>
                  ))}
                  {place.email && (
                    <a href={`mailto:${place.email}`} className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted transition-colors" style={{ borderColor: TEAL_COLOR }}>
                      <Mail className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                      <span className="text-sm" style={{ color: TEAL_COLOR }}>{place.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 sm:p-3 border bg-card rounded-lg">
              <h2 className="text-xl sm:text-lg font-semibold mb-3 sm:mb-2">Reviews</h2>
              <ReviewSection itemId={place.id} itemType="adventure_place" />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <SimilarItems currentItemId={place.id} itemType="adventure" location={place.location} country={place.country} />
        </div>
      </main>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <MultiStepBooking
            onSubmit={handleBookingSubmit}
            facilities={facilities}
            activities={activities}
            priceAdult={place.entry_fee || 0}
            priceChild={0}
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
