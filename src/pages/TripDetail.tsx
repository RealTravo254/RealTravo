import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";

import { Button } from "@/components/ui/button";
import { MapPin, Share2, Heart, Calendar, Copy, CheckCircle2, ArrowLeft, Star, Phone, Mail, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ReviewSection } from "@/components/ReviewSection";
import { useSavedItems } from "@/hooks/useSavedItems";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { getSlugLookupCandidates } from "@/lib/slugUtils";
import { useBookingSubmit, BookingFormData } from "@/hooks/useBookingSubmit";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { DetailMapSection } from "@/components/detail/DetailMapSection";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ImageGalleryModal } from "@/components/detail/ImageGalleryModal";
import { Footer } from "@/components/Footer";

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

const SELECT_FIELDS = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,phone_number,email,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date,inclusions,exclusions,allow_children,ticket_types,slot_limit_type";

const TripDetail = () => {
  const { slug: rawSlug } = useParams();
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  
  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const currentItemId = event?.id || "";
  const isSaved = savedItems.has(currentItemId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (rawSlug) fetchTrip();
  }, [rawSlug]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refSlug = urlParams.get("ref");
    if (refSlug && event?.id) trackReferralClick(refSlug, event.id, "trip", "booking");
  }, [event?.id]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  const fetchTrip = async () => {
    if (!rawSlug) return;
    setLoading(true);
    setEvent(null);

    try {
      const candidates = getSlugLookupCandidates(rawSlug);

      const findMatch = (rows: any[] | null | undefined, field: "id" | "slug") => {
        if (!rows?.length) return null;
        for (const candidate of candidates) {
          const match = rows.find((row) => row?.[field] === candidate);
          if (match) return match;
        }
        return rows[0] || null;
      };

      const fetchByField = async (field: "id" | "slug", type?: string) => {
        let query: any = supabase.from("trips").select(SELECT_FIELDS).in(field, candidates);
        if (type) query = query.eq("type", type);
        const { data } = await query;
        return findMatch(data, field);
      };

      const data =
        (await fetchByField("id", "trip")) ||
        (await fetchByField("slug", "trip")) ||
        (await fetchByField("id")) ||
        (await fetchByField("slug"));

      if (!data) throw new Error("Not found");
      setEvent(data);
    } catch (error) {
      toast({ title: "Trip not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = () => currentItemId && handleSaveItem(currentItemId, "trip");

  const handleCopyLink = async () => {
    if (!event) return;
    const link = getShareLink(event.id, "trip", event.name, event.location);
    await navigator.clipboard.writeText(link);
    toast({ title: "Link Copied!" });
  };

  const handleShare = async () => {
    if (!event) return;
    const link = getShareLink(event.id, "trip", event.name, event.location);
    if (navigator.share) {
      try { await navigator.share({ title: event.name, url: link }); } catch (e) {}
    } else { 
      await navigator.clipboard.writeText(link);
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
        itemId: event.id, itemName: event.name, bookingType: 'trip', totalAmount,
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

  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(event?.id || undefined, event?.available_tickets || 0);

  if (loading) return <TealLoader />;
  if (!event) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = event.date ? new Date(event.date) : null;
  const isExpired = !event.is_custom_date && eventDate && eventDate < today;
  const canBook = !isExpired && !isSoldOut;
  const allImages = [event?.image_url, ...(event?.gallery_images || []), ...(event?.images || [])].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  return (
    <div className="min-h-screen bg-background pb-24">

      <DetailNavBar
        scrolled={scrolled}
        itemName={event.name}
        isSaved={isSaved}
        onSave={handleSave}
        onBack={goBack}
      />

      {/* ── Image gallery — flush under header, no gap, no border-radius on desktop ── */}
      <div className="w-full">
        {/* Mobile carousel — full width, no border-radius, no top padding */}
        <div className="relative w-full bg-slate-900 md:hidden" style={{ height: "65vw", minHeight: "300px", maxHeight: "520px" }}>
          <Carousel
            setApi={setCarouselApi}
            plugins={[Autoplay({ delay: 4000 })]}
            className="w-full h-full"
          >
            <CarouselContent className="h-full ml-0">
              {allImages.map((img, idx) => (
                <CarouselItem key={idx} className="h-full pl-0 basis-full">
                  <div className="relative h-full w-full">
                    <img src={img} alt={`${event.name} - ${idx + 1}`} className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent z-10" />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Dot indicators */}
          {allImages.length > 1 && (
            <div className="absolute bottom-16 left-0 right-0 z-30 flex justify-center gap-1.5">
              {allImages.slice(0, 5).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => carouselApi?.scrollTo(idx)}
                  className="transition-all duration-300"
                  style={{
                    width: activeSlide === idx ? "20px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: activeSlide === idx ? "white" : "rgba(255,255,255,0.45)",
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {allImages.length > 1 && <ImageGalleryModal images={allImages} name={event.name} />}

          {/* Title overlay */}
          <div className="absolute bottom-5 left-0 z-40 w-full px-4 pointer-events-none">
            <div className="pointer-events-auto bg-gradient-to-r from-black/70 via-black/40 to-transparent rounded-2xl p-4 max-w-xl">
              <Button className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-3 py-1 h-auto uppercase font-black tracking-[0.1em] text-[9px] rounded-full shadow-lg mb-2">Trip</Button>
              <h1 className="text-xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl mb-1">{event.name}</h1>
              <div className="flex items-center gap-2 cursor-pointer" onClick={openInMaps}>
                <MapPin className="h-3.5 w-3.5 text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">{[event.place, event.location, event.country].filter(Boolean).join(', ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop grid — no border-radius, no top padding, flush under header */}
        <div className="hidden md:block">
          <div className="grid grid-cols-4 gap-0.5 h-[480px]">
            {allImages.length > 0 ? (
              <>
                {/* Main large image */}
                <div className="col-span-2 row-span-2 overflow-hidden relative group">
                  <img src={allImages[0]} alt={event.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 z-20">
                    <div className="space-y-2">
                      <Button className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-4 py-1.5 h-auto uppercase font-black tracking-[0.1em] text-[10px] rounded-full shadow-lg">Trip</Button>
                      <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">{event.name}</h1>
                      <div className="flex items-center gap-2 cursor-pointer group/map w-fit" onClick={openInMaps}>
                        <MapPin className="h-4 w-4 text-white" />
                        <span className="text-sm font-bold text-white uppercase tracking-wide">{[event.place, event.location, event.country].filter(Boolean).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Top-right image */}
                {allImages[1] && (
                  <div className="col-span-2 overflow-hidden relative group">
                    <img src={allImages[1]} alt={`${event.name} - 2`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                {/* Bottom-right grid */}
                <div className="col-span-2 grid grid-cols-3 gap-0.5">
                  {allImages.slice(2, 5).map((img, idx) => (
                    <div key={idx} className="overflow-hidden relative group">
                      <img src={img} alt={`${event.name} - ${idx + 3}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                <ImageGalleryModal images={allImages} name={event.name} />
              </>
            ) : (
              <div className="col-span-4 bg-slate-200 flex items-center justify-center">
                <p className="text-slate-400 font-black uppercase text-sm">No Images Available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="container px-4 max-w-6xl mx-auto mt-6 relative z-10">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-4" style={{ color: COLORS.TEAL }}>About this Trip</h2>
              {event.description ? (
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
              ) : (
                <p className="text-muted-foreground text-sm italic">No description provided.</p>
              )}
            </div>

            {event.activities?.length > 0 && (
              <div className="bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tight mb-5" style={{ color: COLORS.TEAL }}>Highlights</h2>
                <div className="flex flex-wrap gap-3">
                  {event.activities.map((act: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#F0E68C]/20 border border-[#F0E68C]/50">
                      <CheckCircle2 className="h-4 w-4 text-[#857F3E]" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-[#857F3E] uppercase tracking-wide">{act.name}</span>
                        <span className="text-[10px] font-bold text-[#857F3E]/70">{act.price === 0 || act.is_free ? "Included" : formatPrice(Number(act.price))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions & Exclusions — desktop */}
            {((event.inclusions && event.inclusions.length > 0) || (event.exclusions && event.exclusions.length > 0)) && (
              <div className="hidden lg:block bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tight mb-5" style={{ color: COLORS.TEAL }}>Package Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {event.inclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-3">✓ What's Included</p>
                      <ul className="space-y-2">
                        {event.inclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.exclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-3">✗ Not Included</p>
                      <ul className="space-y-2">
                        {event.exclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                            <span className="text-red-400 mt-0.5">✗</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="hidden lg:block bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="trip" />
            </div>
          </div>

          {/* ── Right column / Booking card ── */}
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 lg:sticky lg:top-24">

              {/* Price + slots */}
              <div className="flex justify-between items-end mb-5">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Price</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-destructive">{formatPrice(event.price)}</span>
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

              {/* Operating hours */}
              {(event.opening_hours || event.closing_hours || (event.is_flexible_date && event.days_opened?.length > 0)) && (
                <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {(event.opening_hours || event.closing_hours) && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Hours
                      </span>
                      <span className="text-xs font-black text-slate-700">{event.opening_hours || "08:00"} - {event.closing_hours || "18:00"}</span>
                    </div>
                  )}
                  {event.is_flexible_date && event.days_opened?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Available Days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {event.days_opened.map((day: string, i: number) => (
                          <span key={i} className="px-3 py-1 rounded-lg bg-primary/10 text-[9px] font-black uppercase text-primary border border-primary/20">{day}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Availability bar */}
              <div className="mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Users className="h-3 w-3" /> Availability
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

              {/* Trip details */}
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Scheduled Date</span>
                  <span className={isExpired ? "text-red-500" : "text-slate-700"}>
                    {event.is_custom_date
                      ? <span className="text-emerald-600 font-black">AVAILABLE</span>
                      : (<>{new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{isExpired && <span className="ml-1">(Past)</span>}</>)
                    }
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Children Allowed</span>
                  <span className={event.allow_children === false ? "text-red-500 font-black" : "text-emerald-600 font-black"}>
                    {event.allow_children === false ? "No" : "Yes"}
                  </span>
                </div>
                {event.allow_children !== false && (
                  <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                    <span className="text-slate-400">Child (Under 12)</span>
                    <span className="text-slate-700">{formatPrice(event.price_child || 0)}</span>
                  </div>
                )}
                {event.ticket_types && Array.isArray(event.ticket_types) && event.ticket_types.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Ticket Types</p>
                    {event.ticket_types.map((ticket: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-bold uppercase tracking-tight py-1">
                        <span className="text-slate-500">{ticket.name}</span>
                        <span className="text-slate-700">{formatPrice(Number(ticket.price))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reserve button */}
              <Button
                onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
                disabled={!canBook}
                className="w-full py-7 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                style={{
                  background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                  boxShadow: !canBook ? "none" : `0 12px 24px -8px ${COLORS.CORAL}88`
                }}
              >
                {isSoldOut ? "Fully Booked" : isExpired ? "Trip Expired" : "Reserve Spot"}
              </Button>

              {/* ✅ Utility buttons BELOW reserve, separated by border — no z-index clash */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
                <UtilityButton icon={<MapPin className="h-5 w-5" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-5 w-5" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-5 w-5" />} label="Share" onClick={handleShare} />
              </div>

              {/* Contact */}
              {(event.phone_number || event.email) && (
                <div className="space-y-3 mt-5 pt-5 border-t border-slate-100">
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
              )}
            </div>

            {/* Inclusions & Exclusions — mobile */}
            {((event.inclusions && event.inclusions.length > 0) || (event.exclusions && event.exclusions.length > 0)) && (
              <div className="lg:hidden bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tight mb-5" style={{ color: COLORS.TEAL }}>Package Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {event.inclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-3">✓ What's Included</p>
                      <ul className="space-y-2">
                        {event.inclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.exclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-3">✗ Not Included</p>
                      <ul className="space-y-2">
                        {event.exclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                            <span className="text-red-400 mt-0.5">✗</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="lg:hidden bg-white rounded-[28px] p-7 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="trip" />
            </div>
          </div>
        </div>

        <DetailMapSection
          currentItem={{ id: event.id, name: event.name, latitude: null, longitude: null, location: event.location, country: event.country, image_url: event.image_url, price: event.price }}
          itemType="trip"
        />
      </main>

      <Footer />

      {/* ── Fixed mobile bottom bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-destructive">{formatPrice(event.price)}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">/ adult</span>
            </div>
            {event.price_child != null && (
              <div className="text-[10px] font-bold text-slate-500">Child: {formatPrice(event.price_child || 0)}</div>
            )}
          </div>
          <Button
            onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
            disabled={!canBook}
            className="px-6 py-5 rounded-xl text-xs font-black uppercase tracking-widest text-white border-none"
            style={{ background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
          >
            {isSoldOut ? "Fully Booked" : isExpired ? "Expired" : "Reserve"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className="flex-col h-auto py-3 bg-[#F0E68C]/10 text-[#857F3E] rounded-2xl hover:bg-[#F0E68C]/30 transition-colors border border-[#F0E68C]/20"
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Button>
);

export default TripDetail;