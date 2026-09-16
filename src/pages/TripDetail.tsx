import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { Button } from "@/components/ui/button";
import {
  MapPin, Share2, Copy, Clock, Users,
  ChevronLeft, ChevronRight, Grid2X2, Zap, Navigation, ExternalLink, Check, X,
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

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the detail pages: deep
// forest for structure and trust, a warm clay for the primary action, and a
// dry-grass gold reserved for "special" content. Ink is a green-tinted
// charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const GOLD         = "#B98A2A";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const DANGER       = "#9C3B2B";
const SUCCESS      = "#2F6F4E";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

const SELECT_FIELDS = "id,name,location,place,country,image_url,gallery_images,images,date,is_custom_date,price,price_child,available_tickets,description,activities,created_by,type,opening_hours,closing_hours,days_opened,map_link,is_flexible_date,inclusions,exclusions,allow_children,ticket_types,slot_limit_type,pickup_location";

// Converts ANY casing ("SAFARI WEEKEND", "safari weekend") into "Safari Weekend" —
// first letter of each word capitalised, everything else lower case.
const toTitleCase = (str?: string) => {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─── Screen-size hook ─────────────────────────────────────────────────────────
// Lets us mount only ONE of <MobileCarousel /> / <DesktopGallery /> at a time,
// instead of mounting both and just hiding one with CSS (which still fetches
// every image for the hidden layout).
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
};

// ─── Small shared bits ────────────────────────────────────────────────────────
// A section heading with a short colored rule underneath instead of an
// all-caps tracked-out eyebrow — the rule reads as a deliberate underline,
// not decoration.
const SectionHeading = ({ title, color }: { title: string; color: string }) => (
  <div className="mb-3.5">
    <h2 className="text-lg md:text-xl font-semibold leading-none" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
      {title}
    </h2>
    <span className="block w-9 h-[3px] rounded-full mt-2" style={{ background: color }} />
  </div>
);

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
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "rgba(14,23,18,0.97)", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-[12px] font-semibold" style={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.6)" }}>{name}</span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold" style={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.45)" }}>{current + 1} / {images.length}</span>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-white text-lg font-bold"
            style={{ background: "rgba(255,255,255,0.1)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4">
        <img src={images[current]} alt={`${name} ${current + 1}`}
          className="max-h-full max-w-full object-contain select-none rounded-xl" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={() => setCurrent((p) => (p + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex-shrink-0 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 w-max mx-auto">
            {images.map((img, idx) => (
              <button key={idx} onClick={() => setCurrent(idx)} className="flex-shrink-0 transition-all rounded-md overflow-hidden"
                style={{ width: 56, height: 42, outline: idx === current ? `2px solid ${CLAY_LIGHT}` : "2px solid transparent", outlineOffset: 1, opacity: idx === current ? 1 : 0.5 }}>
                {/* Thumbnails only load once the gallery/"see all" is actually opened */}
                <img src={img} alt="" loading="lazy" className="w-full h-full object-cover rounded-md" />
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
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <div className="relative rounded-[28px] overflow-hidden" style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "210px 136px", gap: "4px", border: `1px solid ${HAIRLINE}` }}>
          {/* Only the 3 visible thumbnails are fetched — the rest stay unloaded until "see all" is opened */}
          <div style={{ gridRow: "1 / 3", overflow: "hidden", cursor: "pointer" }} onClick={() => open(0)}>
            {images[0] && <img src={images[0]} alt={name} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />}
          </div>
          <div style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => open(1)}>
            {images[1] && <img src={images[1]} alt={`${name} 2`} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />}
          </div>
          <div style={{ overflow: "hidden", position: "relative", cursor: "pointer" }} onClick={() => open(2)}>
            {images[2] && <img src={images[2]} alt={`${name} 3`} loading="eager" className="w-full h-full object-cover" />}
            {images.length > 3 && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px] cursor-pointer" style={{ background: "rgba(18,51,34,0.58)" }}>
                <div className="text-center">
                  <span className="text-white text-2xl font-semibold" style={{ fontFamily: FONT_DISPLAY }}>+{images.length - 3}</span>
                  <p className="text-white/85 text-[11px] font-medium mt-0.5" style={{ fontFamily: FONT_BODY }}>See all photos</p>
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
// Only the active slide is ever mounted, so only it gets fetched. The full set
// of images is only requested once the person taps "see all" (modal above).
const MobileCarousel = ({ images, name }: { images: string[]; name: string }) => {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActive((p) => (p + 1) % images.length), 4000);
    return () => clearInterval(iv);
  }, [images.length]);

  useEffect(() => { setLoaded(false); }, [active]);

  const go = (idx: number) => setActive((idx + images.length) % images.length);

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="relative w-full overflow-hidden rounded-b-[28px]"
        style={{ height: "45vh", minHeight: "200px", maxHeight: "360px", background: FOREST_DEEP }}>
        <img
          key={active}
          src={images[active]}
          alt={`${name} ${active + 1}`}
          loading="eager"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: loaded ? 1 : 0 }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
          style={{ background: "linear-gradient(to top, rgba(14,23,18,0.55), transparent)" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => go(active - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center" style={{ background: "rgba(14,23,18,0.45)" }}>
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => go(active + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center" style={{ background: "rgba(14,23,18,0.45)" }}>
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
              className="flex items-center gap-1 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-full transition-all" style={{ background: "rgba(14,23,18,0.5)", fontFamily: FONT_BODY }}>
              <Grid2X2 className="h-3 w-3" /> See all
            </button>
          )}
          <div className="backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(14,23,18,0.5)", fontFamily: FONT_BODY }}>
            {active + 1} / {images.length}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Highlights ───────────────────────────────────────────────────────────────
// Palette re-themed around the forest/clay/gold system — each tag still gets
// its own hue so a long list of activities stays scannable, just tuned to
// sit alongside the rest of the page instead of a generic rainbow set.
const HighlightsTags = ({ activities }: { activities: any[] }) => {
  if (!activities?.length) return null;

  const palettes = [
    { bg: "#FBEDE6", border: "#F0CDB6", text: "#A6431C", dot: CLAY },
    { bg: FOREST_SOFT, border: "#CBDBCB", text: FOREST, dot: FOREST },
    { bg: "#FBF2DD", border: "#EBD8A8", text: "#8A6716", dot: GOLD },
    { bg: "#EEF1F8", border: "#CCD6EC", text: "#3E5590", dot: "#5B7BC4" },
    { bg: "#F1EEF8", border: "#D9CFEE", text: "#5B4C90", dot: "#7B6AC4" },
    { bg: "#E9F5EC", border: "#BFE1CA", text: "#276A45", dot: SUCCESS },
  ];

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${CLAY}16` }}>
          <Zap className="h-4 w-4" style={{ color: CLAY }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Highlights</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {activities.map((act: any, i: number) => {
          const p = palettes[i % palettes.length];
          return (
            <div key={i}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:scale-[1.02]"
              style={{ background: p.bg, borderColor: p.border }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.dot }} />
              <span className="text-[12px] font-semibold leading-none" style={{ color: p.text }}>
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
    <section className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4" style={{ color: FOREST }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Location</h2>
            <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>
              {[name, location, country].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${FOREST}, ${FOREST_DEEP})` }}
        >
          <ExternalLink className="h-3 w-3" />
          Open in Google Maps
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
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CLAY }} />
          <span className="text-[11px] font-semibold" style={{ color: INK }}>{name}</span>
        </div>
      </div>
    </section>
  );
};

// ─── Utility button ───────────────────────────────────────────────────────────
const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick}
    className="flex-col h-auto py-2.5 rounded-xl transition-colors hover:bg-transparent flex-1"
    style={{ background: FOREST_SOFT, border: `1px solid ${HAIRLINE}`, color: INK_SOFT, fontFamily: FONT_BODY }}>
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-medium">{label}</span>
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
  <div className="bg-white rounded-[28px] p-5 lg:sticky lg:top-24" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 30px rgba(28,43,34,0.06)", fontFamily: FONT_BODY }}>

    {/* Price + slots */}
    <div className="flex justify-between items-end mb-4">
      <div>
        <p className="text-[10px] font-medium mb-1" style={{ color: INK_SOFT }}>Ticket price</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold" style={{ color: CLAY }}>{formatPrice(event.price)}</span>
          <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>/ adult</span>
        </div>
      </div>
      <div className="px-3 py-1.5 rounded-xl flex items-center gap-1.5" style={{ background: CANVAS, border: `1px solid ${HAIRLINE}` }}>
        <Clock className="h-3.5 w-3.5" style={{ color: FOREST }} />
        <span className="text-[12px] font-semibold" style={{ color: isSoldOut ? DANGER : INK }}>
          {isSoldOut ? "Full" : `${remainingSlots} left`}
        </span>
      </div>
    </div>

    {/* Hours */}
    {(event.opening_hours || event.closing_hours || (event.is_flexible_date && event.days_opened?.length > 0)) && (
      <div className="mb-4 p-3.5 rounded-2xl" style={{ background: CANVAS, border: `1px solid ${HAIRLINE}` }}>
        {(event.opening_hours || event.closing_hours) && (
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: INK_SOFT }}><Clock className="h-3.5 w-3.5" /> Hours</span>
            <span className="text-[13px] font-semibold" style={{ color: INK }}>{event.opening_hours || "08:00"} – {event.closing_hours || "18:00"}</span>
          </div>
        )}
        {event.is_flexible_date && event.days_opened?.length > 0 && (
          <div className="mt-1.5">
            <p className="text-[10px] font-medium mb-1.5" style={{ color: INK_SOFT }}>Available days</p>
            <div className="flex flex-wrap gap-1">
              {event.days_opened.map((day: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: FOREST_SOFT, color: FOREST }}>{day}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {/* Availability bar */}
    <div className="mb-4 p-3.5 rounded-2xl" style={{ background: CANVAS, border: `1px solid ${HAIRLINE}` }}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: INK_SOFT }}><Users className="h-3.5 w-3.5" /> Availability</span>
        <span className="text-[11px] font-semibold" style={{ color: remainingSlots < 5 ? DANGER : SUCCESS }}>
          {isSoldOut ? "Sold out" : `${remainingSlots} available`}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: HAIRLINE }}>
        <div className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${Math.min((remainingSlots / (event.available_tickets || 50)) * 100, 100)}%`, background: remainingSlots < 5 ? DANGER : SUCCESS }} />
      </div>
    </div>

    {/* Trip meta */}
    <div className="space-y-2.5 mb-4">
      <div className="flex justify-between text-[12px] font-medium">
        <span style={{ color: INK_SOFT }}>Date</span>
        <span className="font-semibold" style={{ color: isExpired ? DANGER : INK }}>
          {event.is_custom_date
            ? <span className="font-semibold" style={{ color: SUCCESS }}>Flexible</span>
            : <>{new Date(event.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{isExpired && " (Past)"}</>
          }
        </span>
      </div>

      <div className="flex justify-between text-[12px] font-medium">
        <span style={{ color: INK_SOFT }}>Children</span>
        <span className="font-semibold" style={{ color: event.allow_children === false ? DANGER : SUCCESS }}>
          {event.allow_children === false ? "Not allowed" : "Allowed"}
        </span>
      </div>

      {event.allow_children !== false && (
        <div className="flex justify-between text-[12px] font-medium">
          <span style={{ color: INK_SOFT }}>Child (under 12)</span>
          <span className="font-semibold" style={{ color: INK }}>{formatPrice(event.price_child || 0)}</span>
        </div>
      )}

      <div className="flex justify-between items-start text-[12px] font-medium gap-2">
        <span className="flex items-center gap-1.5 flex-shrink-0" style={{ color: INK_SOFT }}>
          <Navigation className="h-3.5 w-3.5" /> Pickup
        </span>
        {event.pickup_location ? (
          <span className="text-right font-semibold max-w-[60%] leading-snug capitalize" style={{ color: INK }}>
            {event.pickup_location}
          </span>
        ) : (
          <span className="italic font-medium" style={{ color: INK_SOFT }}>Not available</span>
        )}
      </div>

      {event.ticket_types?.length > 0 && (
        <div className="pt-2.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <p className="text-[10px] font-medium mb-1.5" style={{ color: INK_SOFT }}>Ticket types</p>
          {event.ticket_types.map((ticket: any, i: number) => (
            <div key={i} className="flex justify-between text-[12px] font-medium py-0.5">
              <span style={{ color: INK_SOFT }}>{ticket.name}</span>
              <span className="font-semibold" style={{ color: INK }}>{formatPrice(Number(ticket.price))}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Reserve */}
    <Button
      onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
      disabled={!canBook}
      className="w-full py-6 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98] border-none hover:opacity-95"
      style={{ background: !canBook ? "#B9C2BC" : `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)`, fontFamily: FONT_BODY }}
    >
      {isSoldOut ? "Fully booked" : isExpired ? "Trip expired" : "Reserve spot"}
    </Button>

    {/* Utilities */}
    <div className="grid grid-cols-3 gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <UtilityButton icon={<MapPin className="h-4 w-4" />} label="Map" onClick={openInMaps} />
      <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={handleCopyLink} />
      <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={handleShare} />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const TripDetail = () => {
  useInjectFonts();

  const { slug: rawSlug } = useParams();
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const isMobile = useIsMobile();

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
    toast({ title: "Link copied" });
  };

  const handleShare = async () => {
    if (!event) return;
    const link = getShareLink(event.id, "trip", event.name, event.location);
    if (navigator.share) { try { await navigator.share({ title: event.name, url: link }); } catch {} }
    else { await navigator.clipboard.writeText(link); toast({ title: "Link copied" }); }
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
    <div className="min-h-screen pb-24" style={{ background: CANVAS }}>
      <DetailNavBar scrolled={scrolled} itemName={toTitleCase(event.name)} isSaved={isSaved} onSave={handleSave} onBack={goBack} />

      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Only one gallery layout is ever mounted, based on actual screen size,
          so we never fetch images for the layout the person can't see. */}
      {isMobile ? (
        <MobileCarousel images={allImages} name={event.name} />
      ) : (
        <DesktopGallery images={allImages} name={event.name} />
      )}

      {/* ── Name / badge / location ── */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-1" style={{ fontFamily: FONT_BODY }}>
        <span className="inline-flex items-center gap-1.5 mb-2.5 text-white px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}>
          <Navigation className="h-3 w-3" /> Trip
        </span>
        <h1 className="text-[28px] md:text-[34px] font-semibold leading-tight tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{toTitleCase(event.name)}</h1>
        <button onClick={openInMaps} className="flex items-center gap-1.5 mt-1.5 transition-colors" style={{ color: INK_SOFT }}
          onMouseEnter={(e) => (e.currentTarget.style.color = FOREST)}
          onMouseLeave={(e) => (e.currentTarget.style.color = INK_SOFT)}>
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-[13px] font-medium">{[event.place, event.location, event.country].filter(Boolean).join(", ")}</span>
        </button>
      </div>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <main className="container px-4 max-w-6xl mx-auto mt-5 relative z-10" style={{ fontFamily: FONT_BODY }}>

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
              <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${HAIRLINE}` }}>
                <SectionHeading title="Package details" color={FOREST} />
                <div className="grid grid-cols-2 gap-6">
                  {event.inclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: SUCCESS }}>
                        <Check className="h-3 w-3" /> Included
                      </p>
                      <ul className="space-y-1.5">
                        {event.inclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: INK }}>
                            <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: SUCCESS }} /><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.exclusions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: DANGER }}>
                        <X className="h-3 w-3" /> Not included
                      </p>
                      <ul className="space-y-1.5">
                        {event.exclusions.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: INK }}>
                            <X className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: DANGER }} /><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* About */}
            <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${HAIRLINE}` }}>
              <SectionHeading title="About this trip" color={FOREST} />
              {event.description
                ? <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: INK }}>{event.description}</p>
                : <p className="text-[14px] italic" style={{ color: INK_SOFT }}>No description provided.</p>
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
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white"
        style={{ borderTop: `1px solid ${HAIRLINE}`, boxShadow: "0 -6px 24px rgba(28,43,34,0.08)", paddingBottom: "env(safe-area-inset-bottom, 0px)", fontFamily: FONT_BODY }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold" style={{ color: CLAY }}>{formatPrice(event.price)}</span>
              <span className="text-[10px] font-medium" style={{ color: INK_SOFT }}>/ adult</span>
            </div>
            {event.price_child != null && (
              <div className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Child: {formatPrice(event.price_child || 0)}</div>
            )}
          </div>
          <Button
            onClick={() => navigateToBooking(`/booking/trip/${event.id}`)}
            disabled={!canBook}
            className="px-6 py-5 rounded-xl text-sm font-semibold text-white border-none"
            style={{ background: !canBook ? "#B9C2BC" : `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}
          >
            {isSoldOut ? "Fully booked" : isExpired ? "Expired" : "Reserve"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripDetail;