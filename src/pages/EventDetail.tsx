import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { MapPin, Share2, Heart, Calendar, Copy, CheckCircle2, ArrowLeft, Star, Phone, Mail, Clock, Users } from "lucide-react";
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
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

// Helper component for Review Header to avoid redundancy
const ReviewHeader = ({ event }: { event: any }) => (
  <div className="flex justify-between items-center mb-8">
    <div>
      <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Guest Ratings</h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verified Community Feedback</p>
    </div>
    {event.average_rating > 0 && (
      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
        <Star className="h-4 w-4 fill-[#FF7F50] text-[#FF7F50]" />
        <span className="text-lg font-black" style={{ color: COLORS.TEAL }}>{event.average_rating.toFixed(1)}</span>
      </div>
    )}
  </div>
);

const EventDetail = () => {
  const { slug } = useParams();
  const id = slug ? extractIdFromSlug(slug) : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
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
      let { data, error } = await supabase
        .from("trips")
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by,type")
        .eq("id", id)
        .eq("type", "event")
        .single();
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by,type")
          .ilike("id", `${id}%`)
          .eq("type", "event")
          .single();
        if (!prefixError) { data = prefixData; error = null; }
      }
      if (error) throw error;
      setEvent(data);
    } catch (error) {
      toast({ title: "Event not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = () => id && handleSaveItem(id, "event");
  const handleCopyLink = async () => {
    if (!event) return;
    const refLink = await generateReferralLink(event.id, "event", event.id);
    await navigator.clipboard.writeText(refLink);
    toast({ title: "Link Copied!" });
  };

  const handleShare = async () => {
    if (!event) return;
    const refLink = await generateReferralLink(event.id, "event", event.id);
    if (navigator.share) {
      try { await navigator.share({ title: event.name, url: refLink }); } catch (e) {}
    } else { handleCopyLink(); }
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${event?.name}, ${event?.location}`);
    window.open(event?.map_link || `https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const { submitBooking } = useBookingSubmit();

  const handleBookingSubmit = async (data: BookingFormData) => {
    if (!event) return;
    setIsProcessing(true);
    try {
      const totalAmount = (data.num_adults * event.price) + (data.num_children * (event.price_child || 0));
      await submitBooking({
        itemId: event.id, itemName: event.name, bookingType: 'event', totalAmount,
        slotsBooked: data.num_adults + data.num_children, visitDate: event.date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: event.created_by, bookingDetails: { ...data, event_name: event.name }
      });
      setIsCompleted(true);
      setShowBooking(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  // Real-time availability tracking
  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(id || undefined, event?.available_tickets || 0);

  if (loading) return <div className="min-h-screen bg-slate-50 animate-pulse" />;
  if (!event) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = event.date ? new Date(event.date) : null;
  const isExpired = !event.is_custom_date && eventDate && eventDate < today;
  const canBook = !isExpired && !isSoldOut;

  const allImages = [event?.image_url, ...(event?.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Hero Image Section */}
      <div className="relative w-full overflow-hidden h-[55vh] md:h-[70vh] bg-slate-900">
        <div className="absolute top-4 left-4 right-4 z-50 flex justify-between">
          <Button onClick={() => navigate(-1)} className="rounded-full bg-black/30 backdrop-blur-md text-white border-none w-10 h-10 p-0 hover:bg-black/50 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button onClick={handleSave} className={`rounded-full backdrop-blur-md border-none w-10 h-10 p-0 shadow-lg transition-all ${isSaved ? "bg-red-500" : "bg-black/30 hover:bg-black/50"}`}>
            <Heart className={`h-5 w-5 text-white ${isSaved ? "fill-white" : ""}`} />
          </Button>
        </div>

        <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full ml-0">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full">
                <div className="relative h-full w-full">
                  <img src={img} alt={event.name} className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute bottom-10 left-0 z-40 w-full md:w-3/4 lg:w-1/2 p-8 pointer-events-none">
          <div className="relative z-10 space-y-4 pointer-events-auto">
            <Button className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.15em] text-[10px] rounded-full shadow-lg">Experience</Button>
            <div>
              <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-white drop-shadow-2xl mb-3">{event.name}</h1>
              <div className="flex items-center gap-3 cursor-pointer group w-fit" onClick={openInMaps}>
                 <div className="bg-black/30 backdrop-blur-md p-2 rounded-xl group-hover:bg-[#FF7F50] transition-all duration-300"><MapPin className="h-5 w-5 text-white" /></div>
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-[#FF7F50] uppercase tracking-widest px-2 py-0.5 bg-black/30 rounded-full backdrop-blur-sm">Location</span>
                   <span className="text-sm font-black text-white uppercase tracking-wider group-hover:text-[#008080] transition-colors px-3 py-1 bg-black/30 rounded-full backdrop-blur-sm mt-1">
                     {[event.place, event.location, event.country].filter(Boolean).join(', ')}
                   </span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container px-4 max-w-6xl mx-auto -mt-10 relative z-50">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>About</h2>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>

            {event.activities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tight mb-5" style={{ color: COLORS.TEAL }}>Highlights</h2>
                <div className="flex flex-wrap gap-2">
                  {event.activities.map((act: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-[#F0E68C]/20 px-4 py-2.5 rounded-2xl border border-[#F0E68C]/50">
                      <CheckCircle2 className="h-4 w-4 text-[#857F3E]" />
                      <span className="text-[11px] font-black text-[#857F3E] uppercase tracking-wide">{act.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REVIEWS: Desktop Version (Hidden on mobile) */}
            <div className="hidden lg:block bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="event" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Price</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black" style={{ color: COLORS.RED }}>KSh {event.price}</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">/ adult</span>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: COLORS.TEAL }} />
                  <span className={`text-xs font-black uppercase ${isSoldOut ? "text-red-500" : "text-slate-600"}`}>
                    {isSoldOut ? "FULL" : `${remainingSlots} Left`}
                  </span>
                </div>
              </div>

              <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Users className="h-3 w-3" /> Event Availability
                  </span>
                  <span className={`text-[10px] font-black uppercase ${remainingSlots < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {isSoldOut ? "Sold Out" : `${remainingSlots} Slots Available`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                   <div 
                    className={`h-full transition-all duration-500 ${remainingSlots < 5 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min((remainingSlots / (event.available_tickets || 50)) * 100, 100)}%` }}
                   />
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Scheduled Date</span>
                  <span className={isExpired ? "text-red-500" : "text-slate-700"}>
                    {event.is_custom_date ? (
                      <span className="text-emerald-600 font-black">AVAILABLE</span>
                    ) : (
                      <>
                        {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {isExpired && <span className="ml-1">(Past)</span>}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Child (Under 12)</span>
                  <span className="text-slate-700">KSh {event.price_child || 0}</span>
                </div>
              </div>

              <Button 
                onClick={() => setShowBooking(true)}
                disabled={!canBook}
                className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                style={{ 
                    background: !canBook 
                        ? "#cbd5e1" 
                        : `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                    boxShadow: !canBook ? "none" : `0 12px 24px -8px ${COLORS.CORAL}88`
                }}
              >
                {isSoldOut ? "Fully Booked" : isExpired ? "Event Expired" : "Reserve Spot"}
              </Button>

              <div className="grid grid-cols-3 gap-3 mt-8 mb-8">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={handleShare} />
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</h3>
                {event.phone_number && (
                  <a href={`tel:${event.phone_number}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                    <Phone className="h-4 w-4 text-[#008080]" />
                    <span className="text-xs font-bold uppercase tracking-tight">{event.phone_number}</span>
                  </a>
                )}
                {event.email && (
                  <a href={`mailto:${event.email}`} className="flex items-center gap-3 text-slate-600 hover:text-[#008080] transition-colors">
                    <Mail className="h-4 w-4 text-[#008080]" />
                    <span className="text-xs font-bold uppercase tracking-tight truncate">{event.email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* REVIEWS: Mobile Version (Appears below price card, hidden on desktop) */}
            <div className="lg:hidden bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="event" />
            </div>
          </div>
        </div>

        <div className="mt-16">
           <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
        </div>
      </main>

      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
          <MultiStepBooking 
            onSubmit={handleBookingSubmit} activities={event.activities || []} 
            priceAdult={event.price} priceChild={event.price_child} 
            isProcessing={isProcessing} isCompleted={isCompleted} 
            itemName={event.name} skipDateSelection={true} fixedDate={event.date} 
            skipFacilitiesAndActivities={true} itemId={event.id} bookingType="event" 
            hostId={event.created_by || ""} onPaymentSuccess={() => setIsCompleted(true)}
            onCancel={() => setShowBooking(false)}
            primaryColor={COLORS.TEAL}
            accentColor={COLORS.CORAL}
          />
        </DialogContent>
      </Dialog>

      <MobileBottomBar />
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="flex-col h-auto py-3 bg-[#F0E68C]/10 text-[#857F3E] rounded-2xl hover:bg-[#F0E68C]/30 transition-colors border border-[#F0E68C]/20">
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default EventDetail;