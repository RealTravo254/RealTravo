import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
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
import { generateReferralLink, trackReferralClick } from "@/lib/referralUtils";
import { useBookingSubmit, BookingFormData } from "@/hooks/useBookingSubmit";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { Header } from "@/components/Header";
import { DetailMapSection } from "@/components/detail/DetailMapSection";
import { DetailPageSkeleton } from "@/components/detail/DetailPageSkeleton";
import { ImageGalleryModal } from "@/components/detail/ImageGalleryModal";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const ReviewHeader = ({ event }: { event: any }) => (
  <div className="flex justify-between items-center mb-8">
    <div>
      <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Ratings</h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Community Feedback</p>
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
  const goBack = useSafeBack();
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
    window.scrollTo(0, 0);
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
        .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date")
        .eq("id", id)
        .eq("type", "event")
        .single();
      if (error && id.length === 8) {
        const { data: prefixData, error: prefixError } = await supabase
          .from("trips")
          .select("id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date")
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
    toast({ title: "Copying link..." });
    const refLink = await generateReferralLink(event.id, "event", event.id);
    await navigator.clipboard.writeText(refLink);
    toast({ title: "Link Copied!" });
  };

  const handleShare = async () => {
    if (!event) return;
    toast({ title: "Preparing share..." });
    const refLink = await generateReferralLink(event.id, "event", event.id);
    if (navigator.share) {
      try { await navigator.share({ title: event.name, url: refLink }); } catch (e) {}
    } else { 
      await navigator.clipboard.writeText(refLink);
      toast({ title: "Link Copied!" });
    }
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

  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(id || undefined, event?.available_tickets || 0);

  if (loading) return <DetailPageSkeleton />;
  if (!event) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = event.date ? new Date(event.date) : null;
  const isExpired = !event.is_custom_date && eventDate && eventDate < today;
  const canBook = !isExpired && !isSoldOut;
  const allImages = [event?.image_url, ...(event?.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      {/* Header - All Screens */}
      <Header showSearchIcon={false} />

      {/* HERO / IMAGE GALLERY */}
      <div className="max-w-6xl mx-auto md:px-4 md:pt-3">
        {/* Mobile Carousel View */}
        <div className="relative w-full overflow-hidden h-[55vh] bg-slate-900 md:rounded-3xl md:hidden">
          {/* Action Buttons - Overlaid on Gallery */}
          <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center">
            <Button 
              onClick={goBack} 
              className="rounded-full w-10 h-10 p-0 border-none bg-white/90 backdrop-blur-sm text-slate-900 hover:bg-white shadow-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Button 
              onClick={handleSave} 
              className={`rounded-full w-10 h-10 p-0 border-none shadow-lg backdrop-blur-sm transition-all ${
                isSaved ? "bg-red-500 hover:bg-red-600" : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              <Heart className={`h-5 w-5 ${isSaved ? "fill-white text-white" : "text-slate-900"}`} />
            </Button>
          </div>
          <Carousel plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
            <CarouselContent className="h-full ml-0">
              {allImages.map((img, idx) => (
                <CarouselItem key={idx} className="h-full pl-0 basis-full">
                  <div className="relative h-full w-full">
                    <img src={img} alt={`${event.name} - ${idx + 1}`} className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {/* Mobile See All Gallery Button */}
          {allImages.length > 1 && (
            <ImageGalleryModal images={allImages} name={event.name} />
          )}
          <div className="absolute bottom-6 left-0 z-40 w-full px-4 pointer-events-none">
            <div className="relative z-10 space-y-2 pointer-events-auto bg-gradient-to-r from-black/70 via-black/50 to-transparent rounded-2xl p-4 max-w-xl">
              <Button className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-3 py-1 h-auto uppercase font-black tracking-[0.1em] text-[9px] rounded-full shadow-lg">Event</Button>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">{event.name}</h1>
              <div className="flex items-center gap-2 cursor-pointer group w-fit" onClick={openInMaps}>
                  <MapPin className="h-4 w-4 text-white" />
                  <span className="text-xs font-bold text-white uppercase tracking-wide">
                    {[event.place, event.location, event.country].filter(Boolean).join(', ')}
                  </span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Grid View */}
        <div className="hidden md:block relative">
          {/* Action Buttons - Overlaid on Gallery */}
          <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-center">
            <Button 
              onClick={goBack} 
              className="rounded-full w-12 h-12 p-0 border-none bg-white/90 backdrop-blur-sm text-slate-900 hover:bg-white shadow-lg transition-all"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>

            <Button 
              onClick={handleSave} 
              className={`rounded-full w-12 h-12 p-0 border-none shadow-lg backdrop-blur-sm transition-all ${
                isSaved ? "bg-red-500 hover:bg-red-600" : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              <Heart className={`h-6 w-6 ${isSaved ? "fill-white text-white" : "text-slate-900"}`} />
            </Button>
          </div>

          {/* Image Grid Layout */}
          <div className="grid grid-cols-4 gap-2 h-[550px]">
            {allImages.length > 0 ? (
              <>
                {/* Main Large Image - Takes 2 columns and full height */}
                <div className="col-span-2 row-span-2 rounded-3xl overflow-hidden relative group">
                  <img 
                    src={allImages[0]} 
                    alt={event.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Event Info Overlay */}
                  <div className="absolute bottom-6 left-6 right-6 z-20">
                    <div className="space-y-3">
                      <Button className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.1em] text-[10px] rounded-full shadow-lg">
                        Experience
                      </Button>
                      <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                        {event.name}
                      </h1>
                      <div className="flex items-center gap-2 cursor-pointer group/map w-fit" onClick={openInMaps}>
                        <MapPin className="h-4 w-4 text-white" />
                        <span className="text-sm font-bold text-white uppercase tracking-wide">
                          {[event.place, event.location, event.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Right Image */}
                {allImages[1] && (
                  <div className="col-span-2 rounded-3xl overflow-hidden relative group">
                    <img 
                      src={allImages[1]} 
                      alt={`${event.name} - Gallery 2`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                {/* Bottom Right - 3 Small Images */}
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  {allImages.slice(2, 5).map((img, idx) => (
                    <div key={idx} className="rounded-2xl overflow-hidden relative group">
                      <img 
                        src={img} 
                        alt={`${event.name} - Gallery ${idx + 3}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {idx === 2 && allImages.length > 5 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                          <div className="text-center">
                            <span className="text-white text-2xl font-black">+{allImages.length - 5}</span>
                            <p className="text-white text-xs font-bold uppercase mt-1">More</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="col-span-4 rounded-3xl bg-slate-200 flex items-center justify-center">
                <p className="text-slate-400 font-black uppercase text-sm">No Images Available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MAIN BODY */}
      <main className="container px-4 max-w-6xl mx-auto mt-6 relative z-50">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">
          
          <div className="space-y-6">
            {/* About */}
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>About this Event</h2>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>

            {/* Event Hours */}
            {(event.opening_hours || event.days_opened?.length > 0) && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-teal-50"><Clock className="h-5 w-5 text-[#008080]" /></div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>Event Hours</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Hours</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {(event.opening_hours || event.closing_hours) && (
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-slate-400">Operating Hours</span>
                      <span className="text-sm font-black text-slate-700">
                        {event.opening_hours || "08:00"} - {event.closing_hours || "18:00"}
                      </span>
                    </div>
                  )}
                  {event.days_opened?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {event.days_opened.map((day: string, i: number) => (
                        <span key={i} className="px-4 py-2 rounded-xl bg-teal-50 text-[10px] font-black uppercase text-[#008080] border border-teal-100">
                          {day}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Highlights / Activities */}
            {event.activities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tight mb-5" style={{ color: COLORS.TEAL }}>Highlights</h2>
                <div className="flex flex-wrap gap-3">
                  {event.activities.map((act: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#F0E68C]/20 border border-[#F0E68C]/50">
                      <CheckCircle2 className="h-4 w-4 text-[#857F3E]" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-[#857F3E] uppercase tracking-wide">{act.name}</span>
                        <span className="text-[10px] font-bold text-[#857F3E]/70">
                          {act.price === 0 || act.is_free ? "Included" : `KSh ${Number(act.price).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews — desktop */}
            <div className="hidden lg:block bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="event" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100 lg:sticky lg:top-24">
              {/* Price + availability badge */}
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

              {/* Availability bar */}
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

              {/* Date + child price */}
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

              {/* CTA */}
              <Button 
                onClick={() => navigate(`/booking/event/${event.id}`)}
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

              {/* Utility buttons */}
              <div className="grid grid-cols-3 gap-3 mt-8 mb-8">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={handleShare} />
              </div>

              {/* Contact */}
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

            {/* Reviews — mobile */}
            <div className="lg:hidden bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="event" />
            </div>
          </div>
        </div>

        {/* Map Section */}
        <DetailMapSection
          currentItem={{
            id: event.id,
            name: event.name,
            latitude: null,
            longitude: null,
            location: event.location,
            country: event.country,
            image_url: event.image_url,
            price: event.price,
          }}
          itemType="event"
        />

        {/* Similar Items */}
        <div className="mt-16">
           <SimilarItems currentItemId={event.id} itemType="trip" location={event.location} country={event.country} />
        </div>
      </main>

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