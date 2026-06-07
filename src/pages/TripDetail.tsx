import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { Button } from "@/components/ui/button";
import {
  MapPin, Share2, Copy, Clock, Users,
  ChevronLeft, ChevronRight, Grid2X2, Zap, Navigation, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedItems } from "@/hooks/useSavedItems";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { getSlugLookupCandidates } from "@/lib/slugUtils";
import { useBookingSubmit, BookingFormData } from "@/hooks/useBookingSubmit";
import { useRealtimeItemAvailability } from "@/hooks/useRealtimeBookings";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Footer } from "@/components/Footer";

const TEAL        = "#008080";
const CORAL       = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

const SELECT_FIELDS = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date,inclusions,exclusions,allow_children,ticket_types,slot_limit_type,pickup_location";

// ─── Image Gallery Modal ──────────────────────────────────────────────────────
const ImageGalleryModal = ({
  images, name, startIndex = 0, onClose,
}: {
  images: string[]; name: string; startIndex?: number; onClose: () => void;
}) => {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((p) => (p + 1) % images.length);
      if (e.key === "ArrowLeft") setCurrent((p) => (p - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{name}</span>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs font-bold">{current + 1} / {images.length}</span>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-lg font-bold">
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        <img src={images[current]} alt={`${name} ${current + 1}`}
          className="max-h-full max-w-full object-contain select-none" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={() => setCurrent((p) => (p + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex-shrink-0 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 w-max mx-auto">
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setCurrent(idx)} className="flex-shrink-0 transition-all"
                style={{ width: 56, height: 42, outline: idx === current ? `2px solid ${CORAL}` : "2px solid transparent", outlineOffset: 1, opacity: idx === current ? 1 : 0.5 }}>
                <img src={img} alt="" className="w-full h-full object-cover" style={{ borderRadius: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Desktop gallery grid ─────────────────────────────────────────────────────
const DesktopGallery = ({ images, name }: { images: string[]; name: string }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);
  const open = (idx: number) => { setModalStart(idx); setModalOpen(true); };

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="hidden md:block max-w-6xl mx-auto px-4 pt-4">
        <div className="relative" style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "200px 130px", gap: "3px", borderRadius: 0 }}>
          <div style={{ gridRow: "1 / 3", overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(0)}>
            {images[0] && <img src={images[0]} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />}
          </div>
          <div style={{ overflow: "hidden", borderRadius: 0, cursor: "pointer" }} onClick={() => open(1)}>
            {images[1] && <img src={images[1]} alt={`${name} 2`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ borderRadius: 0 }} />}
          </div>
          <div style={{ overflow: "hidden", borderRadius: 0, position: "relative", cursor: "pointer" }} onClick={() => open(2)}>
            {images[2] && <img src={images[2]} alt={`${name} 3`} className="w-full h-full object-cover" style={{ borderRadius: 0 }} />}
            {images.length > 3 && (
              <div className="absolute inset-0 bg-black/52 flex items-center justify-center backdrop-blur-[1px] cursor-pointer">
                <div className="text-center">
                  <span className="text-white text-2xl font-black">+{images.length - 3}</span>
                  <p className="text-white text-[10px] font-black uppercase tracking-widest mt-0.5">See All</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Mobile carousel ──────────────────────────────────────────────────────────
const MobileCarousel = ({ images, name }: { images: string[]; name: string }) => {
  const [active, setActive] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % images.length), 4000);
    return () => clearInterval(iv);
  }, [images.length]);

  const go = (idx: number) => setActive((idx + images.length) % images.length);

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="relative md:hidden w-full overflow-hidden bg-slate-900"
        style={{ height: "45vh", minHeight: "200px", maxHeight: "360px", borderRadius: 0 }}>
        {images.map((img, idx) => (
          <img key={idx} src={img} alt={`${name} ${idx + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: active === idx ? 1 : 0, borderRadius: 0 }} />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => go(active - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => go(active + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 pointer-events-none">
            {images.slice(0, 6).map((_, idx) => (
              <span key={idx} className="transition-all duration-300 block pointer-events-auto cursor-pointer"
                onClick={() => go(idx)}
                style={{ width: active === idx ? "20px" : "6px", height: "6px", borderRadius: "3px", background: active === idx ? "white" : "rgba(255,255,255,0.45)" }} />
            ))}
          </div>
        )}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {images.length > 1 && (
            <button onClick={() => { setModalStart(active); setModalOpen(true); }}
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full hover:bg-black/70 transition-all">
              <Grid2X2 className="h-3 w-3" /> See All
            </button>
          )}
          <div className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            {active + 1} / {images.length}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Highlights ───────────────────────────────────────────────────────────────
const HighlightsTags = ({ activities }: { activities: any[] }) => {
  if (!activities?.length) return null;

  const palettes = [
    { bg: "#FFF0EB", border: "#FFD5C2", text: "#C24D1A", dot: CORAL },
    { bg: "#E6F7F7", border: "#B2E4E4", text: "#006666", dot: TEAL },
    { bg: "#FFF8E6", border: "#FFE5A0", text: "#8A6200", dot: "#F0A500" },
    { bg: "#F0F4FF", border: "#C7D4FF", text: "#3A56C4", dot: "#5B7BE8" },
    { bg: "#F3F0FF", border: "#D4C9FF", text: "#5B3FC4", dot: "#7B5EE8" },
    { bg: "#EFFFF5", border: "#B6EDD0", text: "#1A7A45", dot: "#2DB461" },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${CORAL}18` }}>
          <Zap className="h-3.5 w-3.5" style={{ color: CORAL }} />
        </div>
        <h2 className="text-base font-black uppercase tracking-tight" style={{ color: CORAL }}>Highlights</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {activities.map((act: any, i: number) => {
          const p = palettes[i % palettes.length];
          return (
            <div key={i}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.03] hover:shadow-sm"
              style={{ background: p.bg, borderColor: p.border }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.dot }} />
              <span className="text-[12px] font-black uppercase tracking-tight leading-none" style={{ color: p.text }}>
                {act.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Map Section ──────────────────────────────────────────────────────────────
const TripMapSection = ({
  name, location, country, mapLink,
}: {
  name: string;
  location?: string;
  country?: string;
  mapLink?: string;
}) => {
  const searchQuery = encodeURIComponent([name, location, country].filter(Boolean).join(", "));
  const coordMatch = mapLink?.match(/[?&]q=([-\d.]+),([-\d.]+)/);
  const googleMapsUrl = mapLink || `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  const embedUrl = coordMatch
    ? `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${searchQuery}&z=13&output=embed`;

  return (
    <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: TEAL }} />
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight" style={{ color: TEAL }}>Location</h2>
            <p className="text-[10px] text-slate-400 font-medium">
              {[name, location, country].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${TEAL}, #005f5f)` }}
        >
          <ExternalLink className="h-3 w-3" />
          View on Google Maps
        </a>
      </div>
      <div style={{ height: "300px", position: "relative" }}>
        <iframe
          title={`Map of ${name}`}
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CORAL }} />
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{name}</span>
        </div>
      </div>
    </section>
  );
};

// ─── Utility button ───────────────────────────────────────────────────────────
const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 bg-[#F0E68C]/15 text-[#857F3E] rounded-xl hover:bg-[#F0E68C]/30 transition-colors border border-[#F0E68C]/30">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tight">{label}</span>
  </Button>
);

// ─── Booking Card (extracted so it can be rendered in two places) ─────────────
const BookingCard = ({
  event,
  formatPrice,
  remainingSlots,
  isSoldOut,
  isExpired,
  canBook,
  navigateToBooking,
  openInMaps,
  handleCopyLink,
  handleShare,
}: {
  event: any;
  formatPrice: (v: number) => string;
  remainingSlots: number;
  isSoldOut: boolean;
  isExpired: boolean;
  canBook: boolean;
  navigateToBooking: (path: string) => void;
  openInMaps: () => void;
  handleCopyLink: () => void;
  handleShare: () => void;
}) => (
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

      <div className="flex justify-between items-start text-xs font-bold uppercase tracking-tight gap-2">
        <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
          <Navigation className="h-3 w-3" /> Pickup
        </span>
        {event.pickup_location ? (
          <span className="text-slate-700 text-right normal-case font-semibold max-w-[60%] leading-snug capitalize">
            {event.pickup_location}
          </span>
        ) : (
          <span className="text-slate-400 italic font-semibold normal-case">Not Available</span>
        )}
      </div>

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
);

// ─── Main component ───────────────────────────────────────────────────────────
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
    await navigator.clipboard.writeText(getShareLink(event.id, "trip", event.name, event.location));
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

  // Shared booking card props
  const bookingCardProps = {
    event,
    formatPrice,
    remainingSlots,
    isSoldOut,
    isExpired,
    canBook,
    navigateToBooking,
    openInMaps,
    handleCopyLink,
    handleShare,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={event.name} isSaved={isSaved} onSave={handleSave} onBack={goBack} />

      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Mobile carousel */}
      <MobileCarousel images={allImages} name={event.name} />

      {/* Desktop gallery grid */}
      <DesktopGallery images={allImages} name={event.name} />

      {/* ── Name / badge / location ── */}
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

        {/* ── Mobile-only: Booking card FIRST, above everything ── */}
        <div className="lg:hidden mb-5">
          <BookingCard {...bookingCardProps} />
        </div>

        <div className="grid lg:grid-cols-[1.7fr,1fr] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Highlights */}
            {event.activities?.length > 0 && (
              <HighlightsTags activities={event.activities} />
            )}

            {/* Inclusions & Exclusions */}
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

            {/* About */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>About this Trip</h2>
              {event.description
                ? <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
                : <p className="text-muted-foreground text-sm italic">No description provided.</p>
              }
            </div>

            {/* Map Section */}
            <TripMapSection
              name={event.name}
              location={event.location}
              country={event.country}
              mapLink={event.map_link}
            />

          </div>

          {/* ── Right column / Booking card — desktop only ── */}
          <div className="hidden lg:block space-y-5">
            <BookingCard {...bookingCardProps} />
          </div>
        </div>
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

export default TripDetail;