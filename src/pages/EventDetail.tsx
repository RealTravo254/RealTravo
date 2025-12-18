import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Share2, Heart, Calendar, Phone, Mail, ArrowLeft, Copy, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SimilarItems } from "@/components/SimilarItems";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
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

const TEAL_COLOR = "#008080";
const ORANGE_COLOR = "#FF9800";
const RED_COLOR = "#FF0000";

const EventDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (id) fetchEvent();
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && id) trackReferralClick(refSlug, id, "event", "booking");
  }, [id]);

  const fetchEvent = async () => {
    if (!id) return;
    try {
      let { data, error } = await supabase.from("trips").select("*").eq("id", id).eq("type", "event").single();
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase.from("trips").select("*").ilike("id", `${id}%`).eq("type", "event").single();
        if (!prefixError) { data = prefixData; error = null; }
      }
      if (error) throw error;
      setEvent(data as any);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({ title: "Event not found", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => { if (id) handleSaveItem(id, "event"); };

  const handleShare = async () => {
    if (!event) return;
    const refLink = await generateReferralLink(event.id, "event", event.id);
    if (navigator.share) {
      try { await navigator.share({ title: event.name, text: `Check out: ${event.name}`, url: refLink }); }
      catch (error) { console.log("Share failed", error); }
    } else {
      await navigator.clipboard.writeText(refLink);
      toast({ title: "Link Copied!" });
    }
  };

  const openInMaps = () => {
    if (event?.map_link) window.open(event.map_link, "_blank");
    else window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event?.location || "")}`, "_blank");
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const totalAmount = data.num_adults * event.price + data.num_children * event.price_child + 
                           data.selectedActivities.reduce((sum, a) => sum + a.price * a.numberOfPeople, 0);
      await submitBooking({
        itemId: event.id, itemName: event.name, bookingType: 'event', totalAmount, slotsBooked: data.num_adults + data.num_children,
        visitDate: event.date, guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: event.created_by,
        bookingDetails: { event_name: event.name, date: event.date, adults: data.num_adults, children: data.num_children, activities: data.selectedActivities }
      });
      setIsProcessing(false);
      setIsCompleted(true);
      toast({ title: "Booking Submitted" });
    } catch (error: any) {
      setIsProcessing(false);
      toast({ title: "Booking failed", variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen bg-background pb-20"><MobileBottomBar /></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center">Event not found</div>;

  const allImages = [event.image_url, ...(event.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-40 md:pb-10">
      <Header className="hidden md:block" /> 
      
      {/* Hero Section */}
      <div className="relative w-full overflow-hidden md:max-w-6xl md:mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="absolute top-4 left-4 z-30 h-10 w-10 p-0 rounded-full text-white bg-black/50" size="icon">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" onClick={handleSave} className={`absolute top-4 right-4 z-30 h-10 w-10 p-0 rounded-full text-white ${isSaved ? "bg-red-500" : "bg-black/50"}`} size="icon">
          <Heart className={`h-5 w-5 ${isSaved ? "fill-white" : ""}`} />
        </Button>
        
        <Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 3000 })]} className="w-full">
          <CarouselContent>
            {allImages.map((img, idx) => (
              <CarouselItem key={idx}>
                <img src={img} alt={event.name} className="w-full h-[42vh] md:h-96 lg:h-[500px] object-cover" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 text-white bg-gradient-to-t from-black/80 to-transparent">
          <h1 className="text-2xl font-bold uppercase">{event.name}</h1> 
        </div>
      </div>
      
      <main className="container px-4 max-w-6xl mx-auto mt-4">
        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="w-full space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" style={{ color: TEAL_COLOR }} />
              <span className="text-sm">{event.location}, {event.country}</span>
            </div>
            {event.description && (
              <div className="bg-card border rounded-lg p-4">
                <h2 className="font-semibold mb-2">About This Event</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
              </div>
            )}
            {event.activities && event.activities.length > 0 && (
              <div className="p-4 border bg-card rounded-lg">
                <h2 className="font-semibold mb-4">Included Activities</h2>
                <div className="flex flex-wrap gap-2">
                  {event.activities.map((activity, idx) => (
                    <div key={idx} className="px-3 py-1 text-white rounded-full text-xs" style={{ backgroundColor: ORANGE_COLOR }}>{activity.name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Only Sidebar */}
          <div className="hidden lg:block space-y-4 sticky top-20 h-fit">
            <div className="p-4 border bg-card rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: TEAL_COLOR }} />
                <p className="font-semibold">{new Date(event.date).toLocaleDateString()}</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: TEAL_COLOR }}>KSh {event.price}</p>
              <Button className="w-full text-white" style={{ backgroundColor: TEAL_COLOR }} onClick={() => setShowBooking(true)} disabled={event.available_tickets <= 0}>Book Now</Button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ReviewSection itemId={event.id} itemType="event" />
          <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
        </div>
      </main>

      {/* FLOATING MOBILE BOTTOM BAR */}
      <div className="fixed bottom-[64px] left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t px-4 py-3 lg:hidden shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col gap-3">
          {/* Row 1: Info Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-[11px] font-bold" style={{ color: ORANGE_COLOR, border: `1px solid ${ORANGE_COLOR}30` }}>
                 <Clock className="h-3 w-3" />
                 UPCOMING EVENT
               </div>
               <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                 <Calendar className="h-3 w-3" style={{ color: TEAL_COLOR }} />
                 {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
               </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground" onClick={openInMaps}>
               <MapPin className="h-3 w-3" style={{ color: TEAL_COLOR }} />
               {event.location.split(',')[0]}
            </div>
          </div>

          {/* Row 2: Price and Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Entry Fee</span>
              <span className="text-xl font-black" style={{ color: TEAL_COLOR }}>KSh {event.price}</span>
            </div>
            <Button 
              className="flex-1 h-12 text-white font-bold rounded-xl shadow-lg" 
              style={{ backgroundColor: TEAL_COLOR }}
              onClick={() => { setIsCompleted(false); setShowBooking(true); }}
              disabled={event.available_tickets <= 0}
            >
              {event.available_tickets <= 0 ? "SOLD OUT" : "BOOK NOW"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} activities={event.activities || []} priceAdult={event.price} priceChild={event.price_child} 
            isProcessing={isProcessing} isCompleted={isCompleted} itemName={event.name} skipDateSelection={true} fixedDate={event.date} 
            skipFacilitiesAndActivities={true} itemId={event.id} bookingType="event" hostId={event.created_by || ""} onPaymentSuccess={() => setIsCompleted(true)} 
          />
        </DialogContent>
      </Dialog>
      <MobileBottomBar />
    </div>
  );
};

export default EventDetail;