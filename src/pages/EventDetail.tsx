import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Icons will be Teal: #008080
import { MapPin, Share2, Heart, Calendar, Phone, Mail, ArrowLeft, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SimilarItems } from "@/components/SimilarItems";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
interface Activity {
  name: string;
  price: number;
}
interface Event {
  id: string;
  name: string;
  location: string;
  country: string;
  place: string;
  image_url: string;
  images: string[];
  description: string;
  price: number;
  price_child: number;
  date: string;
  is_custom_date: boolean;
  available_tickets: number;
  phone_number?: string;
  email?: string;
  map_link?: string;
  activities?: Activity[];
  type: string;
  created_by: string | null;
}

// Define the Teal and Orange colors
const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";
const EventDetail = () => {
  const {
    slug
  } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Not used in current carousel, but kept in case
  const {
    savedItems,
    handleSave: handleSaveItem
  } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  useEffect(() => {
    if (id) {
      fetchEvent();
    }

    // Track referral clicks
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) {
      trackReferralClick(refSlug, id, "event", "booking");
    }
  }, [id]);
  const fetchEvent = async () => {
    if (!id) return;
    try {
      let {
        data,
        error
      } = await supabase.from("trips").select("*").eq("id", id).eq("type", "event").single();
      if (error && id.length === 8) {
        const {
          data: prefixData,
          error: prefixError
        } = await supabase.from("trips").select("*").ilike("id", `${id}%`).eq("type", "event").single();
        if (!prefixError) {
          data = prefixData;
          error = null;
        }
      }
      if (error) throw error;
      setEvent(data as any);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Event not found",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "event");
    }
  };
  const handleCopyLink = async () => {
    if (!event) {
      toast({
        title: "Unable to Copy",
        description: "Event information not available",
        variant: "destructive"
      });
      return;
    }
    const refLink = await generateReferralLink(event.id, "event", event.id);
    try {
      await navigator.clipboard.writeText(refLink);
      toast({
        title: "Link Copied!",
        description: user ? "Share this link to earn commission on bookings!" : "Share this event with others!"
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
    if (!event) {
      toast({
        title: "Unable to Share",
        description: "Event information not available",
        variant: "destructive"
      });
      return;
    }
    const refLink = await generateReferralLink(event.id, "event", event.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.name,
          text: `Check out this event: ${event?.name}`,
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
    if (event?.map_link) {
      window.open(event.map_link, "_blank");
    } else {
      const query = encodeURIComponent(`${event?.name}, ${event?.location}, ${event?.country}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };
  const {
    submitBooking
  } = useBookingSubmit();
  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const totalPeople = data.num_adults + data.num_children;
      const totalAmount = data.num_adults * event.price + data.num_children * event.price_child + data.selectedActivities.reduce((sum, a) => sum + a.price * a.numberOfPeople, 0);
      await submitBooking({
        itemId: event.id,
        itemName: event.name,
        bookingType: 'event',
        totalAmount,
        slotsBooked: totalPeople,
        visitDate: event.date,
        guestName: data.guest_name,
        guestEmail: data.guest_email,
        guestPhone: data.guest_phone,
        hostId: event.created_by,
        bookingDetails: {
          event_name: event.name,
          date: event.date,
          adults: data.num_adults,
          children: data.num_children,
          activities: data.selectedActivities
        }
      });
      setIsProcessing(false);
      setIsCompleted(true);
      toast({
        title: "Booking Submitted",
        description: "Your booking has been saved. Check your email for confirmation."
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking failed",
        description: error.message || "Failed to create booking",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <div className="container px-4 py-6 max-w-6xl mx-auto">
          <div className="h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
        </div>
        <MobileBottomBar />
      </div>;
  }
  if (!event) {
    return <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p>Event not found</p>
        </div>
        <MobileBottomBar />
      </div>;
  }
  const allImages = [event.image_url, ...(event.images || [])].filter(Boolean);
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-6 max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          {/* --- Image Carousel Section --- */}
          <div className="w-full relative opacity-100">
            
            <Carousel className="w-full rounded-2xl overflow-hidden">
              <CarouselContent>
                {allImages.map((img, idx) => <CarouselItem key={idx}>
                    <img src={img} alt={`${event.name} ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-64 md:h-96 object-cover" />
                  </CarouselItem>)}
              </CarouselContent>
              {allImages.length > 1 && <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>}
            </Carousel>
            
            {event.description && <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white p-4 z-10 **sm:p-2**">
                <h2 className="text-lg **sm:text-base** font-semibold mb-2 text-justify">About This Event</h2>
                <p className="text-sm line-clamp-3">{event.description}</p>
              </div>}
          </div>

          {/* --- Detail/Booking Section (Right Column on large screens, Stacked on small) --- */}
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl **sm:text-2xl** font-bold mb-2">{event.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-4 **sm:mb-2**">
                {/* Map Pin Icon Teal */}
                <MapPin className="h-4 w-4" style={{
                color: TEAL_COLOR
              }} />
                <span className="**sm:text-sm**">{event.location}, {event.country}</span>
              </div>
            </div>

            {/* Price and Booking Card */}
            <div className="space-y-3 **sm:space-y-2** p-4 **sm:p-2** border bg-card">
              <div className="flex items-center gap-2">
                {/* Calendar Icon Teal */}
                <Calendar className="h-5 w-5" style={{
                color: TEAL_COLOR
              }} />
                <div>
                  <p className="text-sm **sm:text-xs** text-muted-foreground">Event Date</p>
                  <p className="font-semibold **sm:text-sm**">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="border-t pt-3 **sm:pt-2**">
                <p className="text-sm **sm:text-xs** text-muted-foreground mb-1">Entrance Fee</p>
                <p className="text-2xl **sm:text-xl** font-bold">KSh {event.price}</p>
                {event.price_child > 0 && <p className="text-sm **sm:text-xs** text-muted-foreground">Child: KSh {event.price_child}</p>}
                <p className="text-sm **sm:text-xs** text-muted-foreground mt-2 **sm:mt-1**">Available Tickets: {event.available_tickets}</p>
              </div>

              {/* Book Now Button Teal and dark hover */}
              <Button size="lg" className="w-full text-white **h-10 sm:h-9**" // Reduced height for small screens
            onClick={() => setShowBooking(true)} disabled={event.available_tickets <= 0} style={{
              backgroundColor: TEAL_COLOR
            }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#005555'} onMouseLeave={e => e.currentTarget.style.backgroundColor = TEAL_COLOR}>
                {event.available_tickets <= 0 ? "Sold Out" : "Book Now"}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Map Button: Border/Icon Teal */}
              <Button variant="outline" size="sm" onClick={openInMaps} className="flex-1 **h-9**" // Reduced height for small screens
            style={{
              borderColor: TEAL_COLOR,
              color: TEAL_COLOR
            }}>
                <MapPin className="h-4 w-4 md:mr-2" style={{
                color: TEAL_COLOR
              }} />
                <span className="hidden md:inline">Map</span>
              </Button>
              {/* Copy Link Button: Border/Icon Teal */}
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-1 **h-9**" // Reduced height for small screens
            style={{
              borderColor: TEAL_COLOR,
              color: TEAL_COLOR
            }}>
                <Copy className="h-4 w-4 md:mr-2" style={{
                color: TEAL_COLOR
              }} />
                <span className="hidden md:inline">Copy Link</span>
              </Button>
              {/* Share Button: Border/Icon Teal */}
              <Button variant="outline" size="sm" onClick={handleShare} className="flex-1 **h-9**" // Reduced height for small screens
            style={{
              borderColor: TEAL_COLOR,
              color: TEAL_COLOR
            }}>
                <Share2 className="h-4 w-4 md:mr-2" style={{
                color: TEAL_COLOR
              }} />
                <span className="hidden md:inline">Share</span>
              </Button>
              {/* Save Button: Border/Icon Teal (and filled red if saved) */}
              <Button variant="outline" size="icon" onClick={handleSave} className={`**h-9 w-9** ${isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}`} // Reduced size for small screens
            style={{
              borderColor: TEAL_COLOR,
              color: isSaved ? 'white' : TEAL_COLOR
            }}>
                <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* --- Activities Section --- */}
        {event.activities && event.activities.length > 0 && <div className="mt-6 **sm:mt-4** p-6 **sm:p-3** border bg-card">
            <h2 className="text-xl **sm:text-lg** font-semibold mb-4 **sm:mb-2**">Included Activities</h2>
            <div className="flex flex-wrap gap-2 **sm:gap-1**">
              {event.activities.map((activity, idx) =>
          // Activities Badge Orange
          <div key={idx} className="px-4 py-2 **sm:px-3 sm:py-1** text-white rounded-full text-sm **sm:text-xs** flex items-center gap-2 **sm:gap-1**" style={{
            backgroundColor: ORANGE_COLOR
          }}>
                  <span className="font-medium">{activity.name}</span>
                  <span className="text-xs opacity-90">{activity.price > 0 ? `KSh ${activity.price}` : 'Free'}</span>
                </div>)}
            </div>
          </div>}

        {/* --- Contact Information Section --- */}
        {(event.phone_number || event.email) && <div className="mt-6 **sm:mt-4** p-6 **sm:p-3** border bg-card my-[2px] rounded-none">
            <h2 className="text-xl **sm:text-lg** font-semibold mb-3 **sm:mb-2**">Contact Information</h2>
            <div className="space-y-2 **sm:space-y-1**">
              {event.phone_number && <p className="flex items-center gap-2 **sm:text-sm**">
                  {/* Phone Icon Teal */}
                  <Phone className="h-4 w-4" style={{
              color: TEAL_COLOR
            }} />
                  {/* Phone Link Teal */}
                  <a href={`tel:${event.phone_number}`} className="hover:underline" style={{
              color: TEAL_COLOR
            }}>{event.phone_number}</a>
                </p>}
              {event.email && <p className="flex items-center gap-2 **sm:text-sm**">
                  {/* Mail Icon Teal */}
                  <Mail className="h-4 w-4" style={{
              color: TEAL_COLOR
            }} />
                  {/* Email Link Teal */}
                  <a href={`mailto:${event.email}`} className="hover:underline" style={{
              color: TEAL_COLOR
            }}>{event.email}</a>
                </p>}
            </div>
          </div>}

        {/* --- Review Section --- */}
        <div className="mt-6 **sm:mt-4** rounded-none my-[10px] **sm:my-[5px]**">
          <ReviewSection itemId={event.id} itemType="event" />
        </div>

        {/* --- Similar Items Section --- */}
        <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
      </main>

      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking onSubmit={handleBookingSubmit} activities={event.activities || []} priceAdult={event.price} priceChild={event.price_child} isProcessing={isProcessing} isCompleted={isCompleted} itemName={event.name} skipDateSelection={true} fixedDate={event.date} skipFacilitiesAndActivities={true} itemId={event.id} bookingType="event" hostId={event.created_by || ""} onPaymentSuccess={() => setIsCompleted(true)} />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>;
};
export default EventDetail;