import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { Button } from "@/components/ui/button";
import { MapPin, Share2, Copy, CheckCircle2, Star, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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

const TEAL = "#008080";
const CORAL = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

const ReviewHeader = ({ event }: { event: any }) => (
  <div className="flex justify-between items-center mb-6">
    <div>
      <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: TEAL }}>Ratings</h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Community Feedback</p>
    </div>
    {event.average_rating > 0 && (
      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
        <Star className="h-4 w-4 fill-[#FF7F50] text-[#FF7F50]" />
        <span className="text-base font-black" style={{ color: TEAL }}>{event.average_rating.toFixed(1)}</span>
      </div>
    )}
  </div>
);

const SELECT_FIELDS = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date,inclusions,exclusions,allow_children,ticket_types,slot_limit_type";

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
  const [scrolled, setScrolled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const currentItemId = event?.id || "";
  const isSaved = savedItems.has(currentItemId);

  useEffect(() => { window.scrollTo(0, 0); if (rawSlug) fetchTrip(); }, [rawSlug]);

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
    } catch {
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
    if (navigator.share) { try { await navigator.share({ title: event.name, url: link }); } catch {} }
    else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
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
        itemId: event.id, itemName: event.name, bookingType: "trip", totalAmount,
        slotsBooked: data.num_adults + data.num_children, visitDate: event.date,
        guestName: data.guest_name, guestEmail: data.guest_email, guestPhone: data.guest_phone,
        hostId: event.created_by, bookingDetails: { ...data, event_name: event.name }
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  const { remainingSlots, isSoldOut } = useRealtimeItemAvailability(event?.id || undefined, event?.available_tickets || 0);

  if (loading) return <TealLoader />;
  if (!event) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDate = event.date ? new Date(event.date) : null;
  const isExpired = !event.is_custom_date && eventDate && eventDate < today;
  const canBook = !isExpired && !isSoldOut;
  const allImages = [event?.image_url, ...(event?.gallery_images || []), ...(event?.images || [])].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
  const dotImages = allImages.slice(0, 5);

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={event.name} isSaved={isSaved} onSave={handleSave} onBack={goBack} />

      {/* ══ IMAGE GALLERY + NAME — all in normal block flow, no overlap possible ══ */}

      {/* Spacer — exactly the height of the fixed header so content starts below it */}
      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Mobile carousel — 45vh, overflow-hidden clips image, nothing overlaps below */}
      <div className="relative w-full overflow-hidden bg-slate-900 md:hidden" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>
        <Carousel setApi={setCarouselApi} plugins={[Autoplay({ delay: 4000 })]} className="w-full h-full">
          <CarouselContent className="h-full ml-0">
            {allImages.map((img, idx) => (
              <CarouselItem key={idx} className="h-full pl-0 basis-full">
                <img src={img} alt={`${event.name} - ${idx + 1}`} className="w-full h-full object-cover object-center" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {allImages.length > 1 && <ImageGalleryModal images={allImages} name={event.name} />}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-1.5 pointer-events-none">
            {dotImages.map((_, idx) => (
              <span key={idx} className="transition-all duration-300 block" style={{
                width: activeSlide === idx ? "20px" : "6px", height: "6px", borderRadius: "3px",
                background: activeSlide === idx ? "white" : "rgba(255,255,255,0.5)",
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop gallery — constrained width, rounded, clipped */}
      <div className="hidden md:block max-w-6xl mx-auto px-4 pt-4">
        <div className="relative grid grid-cols-4 gap-1.5 h-[420px] rounded-2xl overflow-hidden">
          {allImages.length > 0 ? (
            <>
              <div className="col-span-2 row-span-2 overflow-hidden group">
                <img src={allImages[0]} alt={event.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              {allImages[1] && (
                <div className="col-span-2 overflow-hidden group">
                  <img src={allImages[1]} alt={`${event.name} - 2`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="col-span-2 grid grid-cols-3 gap-1.5">
                {allImages.slice(2, 5).map((img, idx) => (
                  <div key={idx} className="overflow-hidden relative group">
                    <img src={img} alt={`${event.name} - ${idx + 3}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    {idx === 2 && allImages.length > 3 && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-[2px] cursor-pointer">
                        <div className="text-center">
                          <span className="text-white text-2xl font-black">+{allImages.length - 3}</span>
                          <p className="text-white text-[10px] font-black uppercase tracking-widest mt-0.5">See All</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="col-span-4 bg-slate-200 flex items-center justify-center">
              <p className="text-slate-400 font-black uppercase text-sm">No Images Available</p>
            </div>
          )}
          <ImageGalleryModal images={allImages} name={event.name} />
        </div>
      </div>

      {/* ══ NAME / CATEGORY / LOCATION — always below gallery in normal flow ══ */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-1 bg-background">
        <span className="inline-block mb-2 bg-[#FF7F50] text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">Trip</span>
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-tight text-foreground">{event.name}</h1>
        <button onClick={openInMaps} className="flex items-center gap-1.5 mt-1 text-muted-foreground hover:text-[#008080] transition-colors">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm font-semibold">{[event.place, event.location, event.country].filter(Boolean).join(", ")}</span>
        </button>
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <main className="container px-4 max-w-6xl mx-auto mt-5 relative z-10">
        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* About */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>About this Trip</h2>
              {event.description
                ? <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
                : <p className="text-muted-foreground text-sm italic">No description provided.</p>
              }
            </div>

            {/* Highlights — compact inline chips, NOT buttons */}
            {event.activities?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>Highlights</h2>
                <div className="flex flex-wrap gap-1.5">
                  {event.activities.map((act: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0E68C]/30 border border-[#F0E68C]/60 text-[11px] font-semibold text-[#857F3E]">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      {act.name}
                      {act.price > 0 && !act.is_free && <span className="opacity-60">· {formatPrice(Number(act.price))}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions & Exclusions — all screens */}
            {((event.inclusions?.length > 0) || (event.exclusions?.length > 0)) && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-4" style={{ color: TEAL }}>Package Details</h2>
                <div className="grid grid-cols-2 gap-6">
                  {event.inclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-2">✓ Included</p>
                      <ul className="space-y-1.5">
                        {event.inclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                            <span className="text-emerald-500 mt-0.5">✓</span><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.exclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2">✗ Not Included</p>
                      <ul className="space-y-1.5">
                        {event.exclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                            <span className="text-red-400 mt-0.5">✗</span><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviews — desktop */}
            <div className="hidden lg:block bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <ReviewHeader event={event} />
              <ReviewSection itemId={event.id} itemType="trip" />
            </div>
          </div>

          {/* ── Right column / Booking card ── */}
          <div className="space-y-5">
            <div className="bg-white rounded-[28px] p-5 shadow-2xl border border-slate-100 lg:sticky lg:top-24">

              {/* Price + slots */}
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ticket Price</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-destructive">{formatPrice(event.price)}</span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">/ adult</span>
                  </div>
                </div>
                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#008080]" />
                  <span className={`text-xs font-black uppercase ${isSoldOut ? "text-red-500" : "text-slate-600"}`}>
                    {isSoldOut ? "FULL" : `${remainingSlots} Left`}
                  </span>
                </div>
              </div>

              {/* Hours */}
              {(event.opening_hours || event.closing_hours || (event.is_flexible_date && event.days_opened?.length > 0)) && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {(event.opening_hours || event.closing_hours) && (
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Hours</span>
                      <span className="text-xs font-black text-slate-700">{event.opening_hours || "08:00"} – {event.closing_hours || "18:00"}</span>
                    </div>
                  )}
                  {event.is_flexible_date && event.days_opened?.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Available Days</p>
                      <div className="flex flex-wrap gap-1">
                        {event.days_opened.map((day: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-[9px] font-black uppercase text-primary border border-primary/20">{day}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Availability bar */}
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Users className="h-3 w-3" /> Availability</span>
                  <span className={`text-[10px] font-black uppercase ${remainingSlots < 5 ? "text-red-500" : "text-emerald-600"}`}>
                    {isSoldOut ? "Sold Out" : `${remainingSlots} Available`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${remainingSlots < 5 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min((remainingSlots / (event.available_tickets || 50)) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Trip meta */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Date</span>
                  <span className={isExpired ? "text-red-500" : "text-slate-700"}>
                    {event.is_custom_date
                      ? <span className="text-emerald-600 font-black">FLEXIBLE</span>
                      : <>{new Date(event.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{isExpired && " (Past)"}</>
                    }
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-slate-400">Children</span>
                  <span className={event.allow_children === false ? "text-red-500" : "text-emerald-600"}>
                    {event.allow_children === false ? "Not Allowed" : "Allowed"}
                  </span>
                </div>
                {event.allow_children !== false && (
                  <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                    <span className="text-slate-400">Child (Under 12)</span>
                    <span className="text-slate-700">{formatPrice(event.price_child || 0)}</span>
                  </div>
                )}
                {event.ticket_types?.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Ticket Types</p>
                    {event.ticket_types.map((ticket: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-bold uppercase tracking-tight py-0.5">
                        <span className="text-slate-500">{ticket.name}</span>
                        <span className="text-slate-700">{formatPrice(Number(ticket.price))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reserve */}
              <Button
                onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
                disabled={!canBook}
                className="w-full py-6 rounded-2xl text-sm font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
                style={{ background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}
              >
                {isSoldOut ? "Fully Booked" : isExpired ? "Trip Expired" : "Reserve Spot"}
              </Button>

              {/* Utilities */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                <UtilityButton icon={<MapPin className="h-4 w-4" />} label="Map" onClick={openInMaps} />
                <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={handleCopyLink} />
                <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={handleShare} />
              </div>


            </div>

            {/* Reviews — mobile */}
            <div className="lg:hidden bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
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

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
            style={{ background: !canBook ? "#cbd5e1" : `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}
          >
            {isSoldOut ? "Fully Booked" : isExpired ? "Expired" : "Reserve"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 bg-[#F0E68C]/15 text-[#857F3E] rounded-xl hover:bg-[#F0E68C]/30 transition-colors border border-[#F0E68C]/30">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
  </Button>
);

export default TripDetail;