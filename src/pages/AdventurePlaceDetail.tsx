import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { useBookingNavigate } from "@/hooks/useBookingNavigate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  MapPin, Clock, Share2, Copy, Navigation, AlertCircle,
  Users, CheckCircle2, ChevronLeft, ChevronRight, Grid2X2, ExternalLink,
  Globe, Sparkles, Info, TreePine, Tent, Compass, Building2, Home as HomeIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useGeolocation } from "@/hooks/useGeolocation";
import { trackReferralClick } from "@/lib/referralUtils";
import { getShareLink } from "@/lib/shareUtils";
import { extractIdFromSlug } from "@/lib/slugUtils";
import { DetailNavBar } from "@/components/detail/DetailNavBar";
import { TealLoader } from "@/components/ui/teal-loader";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Footer } from "@/components/Footer";

// ── Design tokens ─────────────────────────────────────────────────────────
// A field-guide / park-signage palette: deep forest for structure and trust,
// a warm clay for the primary action, and a dry-grass gold reserved for
// "special" content. Ink is a green-tinted charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const OPEN_COLOR   = "#2F6F4E";
const CLOSED_COLOR = "#9C3B2B";

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

const FACILITY_LABELS: Record<string, string> = {
  wifi: "Free Wi-Fi", parking: "On-site Parking", toilet: "Flush Toilets",
  shower: "Hot Showers", camping: "Camping Area", picnic: "Picnic Tables",
  braai: "Braai / BBQ Facilities", playground: "Children's Playground",
  restaurant: "Restaurant / Café", swimming: "Swimming Pool",
  security: "24-Hour Security", accessibility: "Wheelchair Accessible",
  pets: "Pet Friendly", guided: "Guided Tours Available",
  first_aid: "First-Aid Station", shop: "On-site Shop / Curio",
};
const facilityLabel = (id: string) =>
  FACILITY_LABELS[id] ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ── Category badge labels + icons ────────────────────────────────────────
// Mirrors the same mapping used on ListingCard so the "Hotel" / "Campsite" /
// etc. wording is consistent between the listing grids and this detail page.
// Each category also gets a small icon so the badge reads at a glance,
// rather than relying on color alone.
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  park: "Park",
  campsite: "Campsite",
  attraction: "Attraction",
  accommodation: "Accommodation",
};
const CATEGORY_ICONS: Record<string, any> = {
  hotel: Building2,
  park: TreePine,
  campsite: Tent,
  attraction: Compass,
  accommodation: HomeIcon,
};

const toTitleCase = (str?: string) => {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

// ── Derive a human-readable place name straight from the URL slug ───────────
// Used ONLY for the initial "Loading <name>…" spinner text, before the actual
// record has been fetched from Supabase. Most slugs look like
// "amboseli-national-park-3f9c2b1a" (name + trailing id), so we strip a
// trailing id-looking segment (a run of 8+ hex/alphanumeric/hyphen chars) and
// title-case what's left. Falls back gracefully to the raw slug if nothing
// can be stripped, and to "" if there's no slug at all.
const slugToDisplayName = (slug?: string | null) => {
  if (!slug) return "";
  const withoutId = slug.replace(/-[0-9a-fA-F]{6,}$/, "");
  const base = (withoutId || slug).trim();
  if (!base) return "";
  return base
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// ─── Time / day helpers for the Open now / Closed check ──────────────────────
// Understands both 24-hour ("08:00", "23:59") and 12-hour ("8:00 AM",
// "11:59 PM") strings, since opening_hours/closing_hours have been seen
// stored in both formats. Returns null if the string can't be parsed.
const parseTimeToMinutes = (t?: string | null): number | null => {
  if (!t) return null;
  const trimmed = t.trim();

  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const mod = ampm[3].toUpperCase();
    if (mod === "PM" && h < 12) h += 12;
    if (mod === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  return null;
};

// Days can be stored as full names ("Monday"), short names ("Mon"), or mixed
// case. Normalizing to a 3-letter lowercase abbreviation lets the working-day
// check line up regardless of which format a given record uses.
const DAY_ABBREV = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const normalizeDayAbbrev = (d: string) =>
  String(d ?? "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase();

// ─── Screen-size hook ─────────────────────────────────────────────────────────
// Used so we only ever mount ONE of <MobileCarousel /> / <DesktopGallery />.
// Previously both were mounted at once (just hidden with CSS), which meant
// images for the gallery you couldn't even see were still being fetched.
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

interface SpecialPriceTier {
  id?: string;
  label: string;
  citizen_price: number;
  non_citizen_price?: number;
  requirement?: string;
}

const ITEMS_PER_PAGE = 5;
// Only 5 images are ever fetched for the main gallery up front.
const GALLERY_IMAGE_LIMIT = 5;

// ─── Small shared bits ────────────────────────────────────────────────────────
// A section heading with a short colored rule underneath instead of an
// all-caps tracked-out eyebrow — the rule reads as a deliberate underline,
// not decoration.
const SectionHeading = ({ title, color }: { title: string; color: string }) => (
  <div className="mb-3.5">
    <h2
      className="text-lg md:text-xl font-semibold leading-none"
      style={{ fontFamily: FONT_DISPLAY, color: INK }}
    >
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, background: "#0E1712",
        display: "flex", flexDirection: "column",
        zIndex: 2147483647,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <span style={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600 }}>
            {current + 1} / {images.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Close gallery"
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700, transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          >✕</button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 48px" }}>
        <img
          key={current} src={images[current]} alt={`${name} ${current + 1}`}
          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 12, userSelect: "none", display: "block" }}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((p) => (p - 1 + images.length) % images.length)}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.10)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.20)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
            ><ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} /></button>
            <button
              onClick={() => setCurrent((p) => (p + 1) % images.length)}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.10)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.20)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
            ><ChevronRight style={{ width: 20, height: 20, color: "#fff" }} /></button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div style={{ flexShrink: 0, padding: "10px 16px", overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", gap: 6, width: "max-content", margin: "0 auto" }}>
            {images.map((img, idx) => (
              <button
                key={idx} onClick={() => setCurrent(idx)}
                style={{ flexShrink: 0, width: 56, height: 42, padding: 0, border: idx === current ? `2px solid ${CLAY_LIGHT}` : "2px solid rgba(255,255,255,0.22)", borderRadius: 8, outline: "none", opacity: idx === current ? 1 : 0.5, cursor: "pointer", overflow: "hidden", boxSizing: "border-box", transition: "opacity 0.15s, border-color 0.15s" }}
              >
                {/* Thumbnails only load once the modal/"see all" is actually opened */}
                <img src={img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 6 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
};

// ─── Desktop gallery grid ─────────────────────────────────────────────────────
const DesktopGallery = ({ images, name }: { images: string[]; name: string }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);
  const open = (idx: number) => { setModalStart(idx); setModalOpen(true); };

  if (!images.length) return null;
  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <div
          className="rounded-[28px] overflow-hidden"
          style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "210px 136px", gap: "4px", border: `1px solid ${HAIRLINE}` }}
        >
          {/* Only the 3 visible thumbnails are fetched — the rest stay unloaded until "see all" is opened */}
          <div style={{ gridRow: "1 / 3", overflow: "hidden", cursor: "pointer" }} onClick={() => open(0)}>
            <img src={images[0]} alt={name} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
          <div style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => open(1)}>
            {images[1] ? <img src={images[1]} alt={`${name} 2`} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full" style={{ background: FOREST_SOFT }} />}
          </div>
          <div style={{ overflow: "hidden", position: "relative", cursor: "pointer" }} onClick={() => open(2)}>
            {images[2] ? <img src={images[2]} alt={`${name} 3`} loading="eager" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: FOREST_SOFT }} />}
            {images.length > 3 && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px]" style={{ background: "rgba(18,51,34,0.58)" }}>
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
// Only the currently active slide is ever in the DOM, so only it gets fetched.
// The full set is only requested once the person taps "see all" (modal above).
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

  if (!images.length) return (
    <div className="w-full flex items-center justify-center font-semibold text-sm" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px", background: FOREST_SOFT, color: INK_SOFT, fontFamily: FONT_BODY }}>
      No photo yet
    </div>
  );

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="relative overflow-hidden" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px", background: FOREST_DEEP }}>
        <img
          key={active}
          src={images[active]}
          alt={`${name} ${active + 1}`}
          loading="eager"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.55), transparent)" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => go(active - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(14,23,18,0.45)" }}>
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => go(active + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(14,23,18,0.45)" }}>
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 pointer-events-none">
            {images.slice(0, 6).map((_, idx) => (
              <span key={idx} className="transition-all duration-300 block pointer-events-auto cursor-pointer" onClick={() => go(idx)}
                style={{ width: active === idx ? "20px" : "6px", height: "6px", borderRadius: "3px", background: active === idx ? "white" : "rgba(255,255,255,0.45)" }} />
            ))}
          </div>
        )}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {images.length > 1 && (
            <button onClick={() => { setModalStart(active); setModalOpen(true); }} className="flex items-center gap-1 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-full transition-all" style={{ background: "rgba(14,23,18,0.5)", fontFamily: FONT_BODY }}>
              <Grid2X2 className="h-3 w-3" /> See all
            </button>
          )}
          <div className="backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(14,23,18,0.5)", fontFamily: FONT_BODY }}>{active + 1} / {images.length}</div>
        </div>
      </div>
    </>
  );
};

// ─── General Amenities ────────────────────────────────────────────────────────
const AmenitiesScroll = ({ amenities, accentColor }: { amenities: string[]; accentColor: string }) => {
  if (!amenities.length) return null;
  return (
    <section className="bg-white rounded-2xl p-4 md:p-5" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <SectionHeading title="Amenities" color={accentColor} />
      <div className="flex flex-wrap gap-1.5">
        {amenities.map((fId, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: FOREST_SOFT, border: `1px solid ${accentColor}22` }}>
            <CheckCircle2 className="h-3 w-3 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: INK }}>{facilityLabel(fId)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const CARD_IMG_HEIGHT = 104;

// Facility card image height stays fixed at every breakpoint — the card
// grows by getting WIDER on large screens (fewer grid columns), not taller.
const FACILITY_IMG_HEIGHT_CLASS = "h-[104px]";

// ─── FacImage ─────────────────────────────────────────────────────────────────
// Renders ONLY a single static image (the first one) — no auto-rotating
// slideshow, so each facility only ever fetches ONE image on initial load.
// The rest of that facility's photos are only fetched if "see all" is opened.
const FacImage = ({ images, name, onClick }: { images: string[]; name: string; onClick?: () => void }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden h-full" style={{ cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <img
        src={images[0]}
        alt={name}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
};

// ─── Facilities Grid ──────────────────────────────────────────────────────────
const InlineFacilitiesGrid = ({ facilities, accentColor }: { facilities: any[]; accentColor: string }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName]     = useState("");
  const [modalStart, setModalStart]   = useState(0);
  const [page, setPage]               = useState(0);

  useEffect(() => { setPage(0); }, [facilities]);

  if (!facilities?.length) return null;

  const totalPages = Math.ceil(facilities.length / ITEMS_PER_PAGE);
  const visibleFacilities = facilities.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  const openCardGallery = (imgs: string[], name: string, startIdx = 0) => { setModalImages(imgs); setModalName(name); setModalStart(startIdx); };
  const facilityAmenityLabel = (amenity: any) => {
    if (!amenity) return "";
    const key = typeof amenity === "string" ? amenity : amenity.name || String(amenity);
    return facilityLabel(key);
  };

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} startIndex={modalStart} onClose={() => setModalImages(null)} />}
      <section style={{ fontFamily: FONT_BODY }}>
        <SectionHeading title="Facilities" color={accentColor} />
        {/* Fewer columns on large screens (3 instead of 5) so each card gets
            noticeably WIDER — image height stays fixed, only the card's
            width (and the image filling it) grows. */}
        <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-3 md:overflow-visible md:pb-0 lg:gap-4">
          {visibleFacilities.map((fac: any, i: number) => {
            const imgs: string[] = Array.isArray(fac.images) ? fac.images.filter(Boolean) : [];
            // "see all" only shows up when there's actually more than one photo to see
            const hasMultiple = imgs.length > 1;
            return (
              <div key={i} className="bg-white overflow-hidden flex-shrink-0 w-[160px] md:w-auto rounded-2xl" style={{ border: `1px solid ${HAIRLINE}` }}>
                {imgs.length > 0 ? (
                  <div className={`relative overflow-hidden ${FACILITY_IMG_HEIGHT_CLASS}`}>
                    <FacImage images={imgs} name={fac.name} onClick={() => openCardGallery(imgs, fac.name, 0)} />
                    {hasMultiple && (
                      <button onClick={(e) => { e.stopPropagation(); openCardGallery(imgs, fac.name, 0); }} className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 backdrop-blur-sm text-white text-[9px] lg:text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all" style={{ background: "rgba(14,23,18,0.55)" }}>
                        <Grid2X2 className="h-2 w-2 lg:h-2.5 lg:w-2.5" /> See all
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center justify-center ${FACILITY_IMG_HEIGHT_CLASS}`} style={{ background: FOREST_SOFT }}>
                    <MapPin className="h-5 w-5 lg:h-7 lg:w-7" style={{ color: `${FOREST}55` }} />
                  </div>
                )}
                <div className="p-2.5 lg:p-3.5">
                  <p className="font-semibold text-[12px] lg:text-sm leading-tight" style={{ color: INK }}>{fac.name}</p>
                  {fac.capacity && <p className="text-[10px] lg:text-xs mt-0.5 flex items-center gap-1" style={{ color: INK_SOFT }}><Users className="h-2.5 w-2.5 lg:h-3.5 lg:w-3.5" /> {fac.capacity}</p>}
                  {fac.price > 0 && <p className="text-[11px] lg:text-sm font-semibold mt-1" style={{ color: accentColor }}>KSh {fac.price?.toLocaleString()}</p>}
                  {Array.isArray(fac.amenities) && fac.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 lg:mt-2">
                      {fac.amenities.slice(0, 5).map((a: any, ai: number) => (
                        <span
                          key={ai}
                          className="text-[9px] lg:text-[10px] font-medium px-1.5 lg:px-2 py-0.5 rounded-full"
                          style={{ background: FOREST_SOFT, color: INK_SOFT }}
                        >
                          {facilityAmenityLabel(a)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous facilities" className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30" style={{ border: `1px solid ${accentColor}40`, color: accentColor }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} aria-label="Next facilities" className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30" style={{ border: `1px solid ${accentColor}40`, color: accentColor }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </>
  );
};

// ─── Activity Card ────────────────────────────────────────────────────────────
// Same single-image treatment as FacImage: only the first photo loads.
const ActivityCard = ({ act, imgs, formatPrice, onImageClick }: { act: any; imgs: string[]; formatPrice: (n: number) => string; onImageClick?: () => void }) => {
  const [loaded, setLoaded] = useState(false);
  const hasMultiple = imgs.length > 1;

  return (
    <div className="bg-white overflow-hidden rounded-2xl" style={{ border: `1px solid ${HAIRLINE}` }}>
      <div className="relative overflow-hidden" style={{ height: CARD_IMG_HEIGHT, cursor: imgs.length > 0 ? "pointer" : "default" }} onClick={imgs.length > 0 ? onImageClick : undefined}>
        {imgs.length > 0 ? (
          <img
            src={imgs[0]}
            alt={act.name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: FOREST_SOFT }}><MapPin className="h-5 w-5" style={{ color: `${FOREST}55` }} /></div>
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.45) 0%, transparent 55%)" }} />
        {/* "see all" only appears when this activity actually has more than one photo */}
        {hasMultiple && (
          <button onClick={(e) => { e.stopPropagation(); onImageClick?.(); }} className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 backdrop-blur-sm text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all" style={{ background: "rgba(14,23,18,0.55)" }}>
            <Grid2X2 className="h-2 w-2" /> See all
          </button>
        )}
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-[12px] leading-tight" style={{ color: INK }}>{act.name}</p>
        {act.price > 0 ? (
          <p className="text-[11px] font-semibold mt-1" style={{ color: CLAY }}>{formatPrice(Number(act.price))}</p>
        ) : (
          <p className="text-[11px] font-semibold mt-1" style={{ color: OPEN_COLOR }}>Free</p>
        )}
      </div>
    </div>
  );
};

// ─── Activities Grid ──────────────────────────────────────────────────────────
const InlineActivitiesGrid = ({ activities, formatPrice }: { activities: any[]; formatPrice: (n: number) => string }) => {
  const [modalImages, setModalImages] = useState<string[] | null>(null);
  const [modalName, setModalName]     = useState("");
  const [modalStart, setModalStart]   = useState(0);
  const [page, setPage]               = useState(0);

  useEffect(() => { setPage(0); }, [activities]);

  if (!activities?.length) return null;

  const totalPages = Math.ceil(activities.length / ITEMS_PER_PAGE);
  const visibleActivities = activities.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);
  const openCardGallery = (imgs: string[], name: string, startIdx = 0) => { setModalImages(imgs); setModalName(name); setModalStart(startIdx); };

  return (
    <>
      {modalImages && <ImageGalleryModal images={modalImages} name={modalName} startIndex={modalStart} onClose={() => setModalImages(null)} />}
      <section style={{ fontFamily: FONT_BODY }}>
        <SectionHeading title="Activities" color={CLAY} />
        <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible md:pb-0">
          {visibleActivities.map((act: any, i: number) => {
            const imgs: string[] = Array.isArray(act.images) ? act.images.filter(Boolean) : [];
            return (
              <div key={i} className="flex-shrink-0 w-[150px] md:w-auto">
                <ActivityCard act={act} imgs={imgs} formatPrice={formatPrice} onImageClick={imgs.length > 0 ? () => openCardGallery(imgs, act.name, 0) : undefined} />
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous activities" className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30" style={{ border: `1px solid ${CLAY}40`, color: CLAY }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} aria-label="Next activities" className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30" style={{ border: `1px solid ${CLAY}40`, color: CLAY }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>
    </>
  );
};

// ─── Special Entry Prices Section ────────────────────────────────────────────
const SpecialPricesSection = ({ tiers, formatPrice }: { tiers: SpecialPriceTier[]; formatPrice: (n: number) => string }) => {
  if (!tiers?.length) return null;
  return (
    <section className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: GOLD_SOFT }}>
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
        </div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Special entry prices</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiers.map((tier, i) => (
          <div key={tier.id ?? i} className="rounded-2xl p-4" style={{ border: `1px solid ${GOLD}30`, background: `${GOLD_SOFT}80` }}>
            <p className="font-semibold text-sm" style={{ color: INK }}>{tier.label}</p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1.5">
              <span className="text-sm font-semibold" style={{ color: GOLD }}>
                {formatPrice(Number(tier.citizen_price) || 0)}{" "}
                <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>citizen</span>
              </span>
              {tier.non_citizen_price != null && Number(tier.non_citizen_price) > 0 && (
                <span className="text-sm font-semibold" style={{ color: CLAY }}>
                  {formatPrice(Number(tier.non_citizen_price))}{" "}
                  <span className="text-[11px] font-normal" style={{ color: INK_SOFT }}>non-citizen</span>
                </span>
              )}
            </div>
            {tier.requirement?.trim() && (
              <div className="flex items-start gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${GOLD}25` }}>
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                <p className="text-[11px] leading-snug" style={{ color: INK_SOFT }}>{tier.requirement}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Always-open Map Section ──────────────────────────────────────────────────
const AlwaysOpenMapSection = ({ name, latitude, longitude, location, country }: { name: string; latitude?: number | null; longitude?: number | null; location?: string; country?: string }) => {
  const hasCoords = latitude != null && longitude != null;
  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${location || ""}, ${country || ""}`)}`;
  const embedUrl = hasCoords
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(`${name}, ${location || ""}, ${country || ""}`)}&z=13&output=embed`;

  return (
    <section className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4" style={{ color: FOREST }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Location</h2>
            <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>{[name, location, country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[11px] font-semibold transition-all hover:opacity-90 active:scale-95" style={{ background: `linear-gradient(135deg, ${FOREST}, ${FOREST_DEEP})` }}>
          <ExternalLink className="h-3 w-3" /> Open in Google Maps
        </a>
      </div>
      <div style={{ height: "300px", position: "relative" }}>
        <iframe title={`Map of ${name}`} src={embedUrl} width="100%" height="100%" style={{ border: 0, display: "block" }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CLAY }} />
          <span className="text-[11px] font-semibold" style={{ color: INK }}>{name}</span>
        </div>
      </div>
    </section>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className="flex-col h-auto py-2.5 rounded-xl flex-1 hover:bg-transparent"
    style={{ background: FOREST_SOFT, border: `1px solid ${HAIRLINE}`, color: INK_SOFT, fontFamily: FONT_BODY }}
  >
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-medium">{label}</span>
  </Button>
);

// ─── Booking card ─────────────────────────────────────────────────────────────
interface BookingCardProps {
  place: any; is24Hours: boolean; daysOpened: string[]; capacityPerDay: number | null;
  formatPrice: (n: number) => string;
  onCheckAvailability: () => void; onMap: () => void; onCopy: () => void; onShare: () => void;
}

const BookingCard = ({ place, is24Hours, daysOpened, capacityPerDay, formatPrice, onCheckAvailability, onMap, onCopy, onShare }: BookingCardProps) => {
  const isPaid = !!(place.entry_fee && Number(place.entry_fee) > 0);
  const hasNonCitizen = !!place.has_non_citizen_pricing &&
    (Number(place.non_citizen_entry_fee) > 0 || Number(place.non_citizen_child_entry_fee) > 0);

  return (
    <div style={{ fontFamily: FONT_BODY }} className="space-y-4">
      {/* ── Pricing: only rendered when entry is actually paid. Free places
          skip this block entirely — no "Free Entry" label is shown anywhere
          on the page, per product request. ── */}
      {isPaid && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
          <div className="grid grid-cols-2" style={{ background: CANVAS }}>
            {/* Citizen column */}
            <div className="p-3.5" style={{ borderRight: `1px solid ${HAIRLINE}` }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: INK_SOFT }}>Citizen</p>
              <p className="text-sm font-semibold" style={{ color: INK }}>{formatPrice(Number(place.entry_fee))}</p>
              {Number(place.child_entry_fee) > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: INK_SOFT }}>Child: {formatPrice(Number(place.child_entry_fee))}</p>
              )}
            </div>
            {/* Non-citizen column */}
            <div className="p-3.5" style={{ background: hasNonCitizen ? GOLD_SOFT : undefined }}>
              <p className="text-[10px] font-medium mb-1 flex items-center gap-1" style={{ color: GOLD }}>
                <Globe className="h-2.5 w-2.5" /> Non-citizen
              </p>
              {hasNonCitizen ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: "#8A6716" }}>{formatPrice(Number(place.non_citizen_entry_fee))}</p>
                  {Number(place.non_citizen_child_entry_fee) > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#8A6716" }}>Child: {formatPrice(Number(place.non_citizen_child_entry_fee))}</p>
                  )}
                </>
              ) : (
                <p className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Same as citizen</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hours & days */}
      <div className="p-3.5 rounded-2xl" style={{ background: CANVAS, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: INK_SOFT }}>
            <Clock className="h-3.5 w-3.5" /> Hours
          </span>
          <span className="text-[13px] font-semibold" style={{ color: INK }}>
            {is24Hours ? "Open 24 hours" : `${place.opening_hours || "08:00"} – ${place.closing_hours || "18:00"}`}
          </span>
        </div>
        {daysOpened.length > 0 && (
          <div>
            <p className="text-[10px] font-medium mb-1.5" style={{ color: INK_SOFT }}>Available days</p>
            <div className="flex flex-wrap gap-1">
              {daysOpened.map((day, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: FOREST_SOFT, color: FOREST }}>{day}</span>
              ))}
            </div>
          </div>
        )}
        {capacityPerDay != null && capacityPerDay > 0 && (
          <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: INK_SOFT }}>
              <Users className="h-3.5 w-3.5" /> Daily capacity
            </span>
            <span className="text-[13px] font-semibold" style={{ color: INK }}>{capacityPerDay} guests</span>
          </div>
        )}
      </div>

      <Button
        onClick={onCheckAvailability}
        className="w-full py-6 rounded-2xl text-sm font-semibold text-white border-none shadow-sm transition-all active:scale-[0.98] hover:opacity-95"
        style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)`, fontFamily: FONT_BODY }}
      >
        Check availability
      </Button>

      <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <UtilityButton icon={<Navigation className="h-4 w-4" />} label="Map" onClick={onMap} />
        <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={onCopy} />
        <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const AdventurePlaceDetail = () => {
  useInjectFonts();

  const { slug: rawSlug } = useParams();
  const id = rawSlug ? extractIdFromSlug(rawSlug) : null;
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const navigateToBooking = useBookingNavigate();
  const { toast } = useToast();
  const { requestLocation } = useGeolocation();
  const { formatPrice } = useCurrency();
  const isMobile = useIsMobile();

  const [place, setPlace]         = useState<any | null>(null);
  const [loading, setLoading]     = useState(true);
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");

  const getStartingPrice = () => {
    if (!place) return 0;
    const prices: number[] = [];
    if (place.entry_fee) prices.push(Number(place.entry_fee));
    [place.facilities, place.activities].forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item: any) => { if (item?.price) prices.push(Number(item.price)); });
    });
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (rawSlug) fetchPlace();
    const refSlug = new URLSearchParams(window.location.search).get("ref");
    if (refSlug && id) trackReferralClick(refSlug, id, "adventure_place", "booking");
    requestLocation();
  }, [rawSlug]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!place) return;
    const checkOpen = () => {
      const now = new Date();
      const currentDayAbbrev = DAY_ABBREV[now.getDay()];

      // Normalize whatever format days_opened is stored in ("Mon", "Monday",
      // "MON", etc.) to a 3-letter lowercase abbreviation so it reliably
      // lines up with currentDayAbbrev. Empty list = open every day. A list
      // that already covers all 7 distinct days is also unambiguously "every
      // day", even if an individual entry's format ever fails to normalize
      // cleanly against currentDayAbbrev.
      const days = Array.isArray(place.days_opened)
        ? place.days_opened.map((d: string) => normalizeDayAbbrev(d)).filter(Boolean)
        : [];
      const uniqueDays = new Set(days);
      const isWorkingDay = !days.length || uniqueDays.size >= 7 || days.includes(currentDayAbbrev);

      if (!isWorkingDay) { setIsOpenNow(false); return; }

      // Missing hours default to a normal 08:00–18:00 window (matching what
      // the "Hours" line itself falls back to), not a silent full-day span —
      // so a place only reads as "open 24 hours" when its data actually says so.
      const openMinutes  = parseTimeToMinutes(place.opening_hours) ?? parseTimeToMinutes("08:00")!;
      const closeMinutes = parseTimeToMinutes(place.closing_hours) ?? parseTimeToMinutes("18:00")!;

      // Figure out the span between open and close (handling overnight
      // wraparound, e.g. opens 18:00 closes 02:00) — if it covers ~the whole
      // day, treat it as open 24 hours on this working day.
      let spanMinutes = closeMinutes - openMinutes;
      if (spanMinutes <= 0) spanMinutes += 24 * 60;
      if (spanMinutes >= 23 * 60 + 59) { setIsOpenNow(true); return; }

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (closeMinutes <= openMinutes) {
        // Overnight span, e.g. 18:00 – 02:00
        setIsOpenNow(nowMinutes >= openMinutes || nowMinutes < closeMinutes);
      } else {
        setIsOpenNow(nowMinutes >= openMinutes && nowMinutes < closeMinutes);
      }
    };
    checkOpen();
    const iv = setInterval(checkOpen, 60_000);
    return () => clearInterval(iv);
  }, [place]);

  const fetchPlace = async () => {
    if (!rawSlug) return;
    try {
      let data: any = null;
      const candidates = [...new Set([id, rawSlug].filter(Boolean))] as string[];
      for (const candidate of candidates) {
        if (data) break;
        const { data: byId } = await supabase.from("adventure_places").select("*").eq("id", candidate).maybeSingle();
        if (byId) { data = byId; break; }
        const { data: bySlug } = await supabase.from("adventure_places").select("*").eq("slug", candidate).maybeSingle();
        if (bySlug) { data = bySlug; break; }
      }
      if (!data && rawSlug) {
        const { data: byPartial } = await supabase.from("adventure_places").select("*").filter("id", "neq", "").limit(100);
        if (byPartial) data = byPartial.find((item) => rawSlug.endsWith(item.id) || rawSlug.includes(item.id)) || null;
      }
      if (!data) throw new Error("Not found");
      setPlace(data);
    } catch (error) {
      console.error("fetch error:", error);
      toast({ title: "Place not found", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCheckAvailability = () => { navigateToBooking(`/booking/adventure_place/${resolvedId}`); };

  // While the record is still being fetched, show the actual place name if
  // we already have it (e.g. re-render after a state update), otherwise
  // derive a readable name straight from the URL slug so the spinner reads
  // "Loading Amboseli National Park…" instead of a generic
  // "Loading Adventure…" message.
  if (loading) {
    const loadingName = place?.name ? toTitleCase(place.name) : slugToDisplayName(rawSlug);
    return <TealLoader text={loadingName ? `Loading ${loadingName}…` : "Loading…"} />;
  }
  if (!place) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: CANVAS, fontFamily: FONT_BODY }}>
      <AlertCircle className="h-12 w-12" style={{ color: CLAY }} />
      <p className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Place not found</p>
      <Button onClick={() => navigate(-1)} className="rounded-full text-white border-none" style={{ background: FOREST }}>Go back</Button>
    </div>
  );

  // Gallery is capped at 5 images so page detail (text) renders and is usable
  // before the browser is asked to fetch a long run of gallery photos.
  const allImages = [place.image_url, ...(place.gallery_images || [])].filter(Boolean).slice(0, GALLERY_IMAGE_LIMIT);
  const is24Hours = (() => {
    const openMinutes  = parseTimeToMinutes(place.opening_hours) ?? parseTimeToMinutes("08:00")!;
    const closeMinutes = parseTimeToMinutes(place.closing_hours) ?? parseTimeToMinutes("18:00")!;
    let spanMinutes = closeMinutes - openMinutes;
    if (spanMinutes <= 0) spanMinutes += 24 * 60;
    return spanMinutes >= 23 * 60 + 59;
  })();
  const resolvedId      = place.id;
  const generalAmenities: string[] = Array.isArray(place.amenities) ? place.amenities.map((a: any) => typeof a === "string" ? a : a.name || "") : [];
  const capacityPerDay: number | null = place.daily_capacity ?? place.capacity_per_day ?? place.capacity ?? null;
  const daysOpened: string[] = Array.isArray(place.days_opened) ? place.days_opened : [];
  const specialPrices: SpecialPriceTier[] = Array.isArray(place.special_entry_prices) ? place.special_entry_prices : [];

  // Category badge label (e.g. "Hotel", "Campsite") — falls back to a
  // title-cased version of whatever category string is on the record so
  // unmapped categories still display something sensible.
  const categoryLabel: string | null = place.category
    ? (CATEGORY_LABELS[place.category] ?? toTitleCase(place.category))
    : null;
  const CategoryIcon = (place.category && CATEGORY_ICONS[place.category]) || MapPin;

  // The live Open now / Closed badge is only meaningful for hotels and
  // campsites, matching the same rule used on the listing cards.
  const isHotelOrCampsite = place.category === "hotel" || place.category === "campsite";

  const bookingCardProps = {
    place, is24Hours, daysOpened, capacityPerDay, formatPrice,
    onCheckAvailability: handleCheckAvailability,
    onMap: () => window.open(
      place.latitude && place.longitude
        ? `https://www.google.com/maps?q=${place.latitude},${place.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.location}`)}`,
      "_blank"
    ),
    onCopy: async () => {
      await navigator.clipboard.writeText(getShareLink(resolvedId, "adventure_place", place.name, place.location));
      toast({ title: "Link copied" });
    },
    onShare: async () => {
      const link = getShareLink(resolvedId, "adventure_place", place.name, place.location);
      if (navigator.share) { try { await navigator.share({ title: place.name, url: link }); } catch {} }
      else { await navigator.clipboard.writeText(link); toast({ title: "Link copied" }); }
    },
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: CANVAS }}>
      <DetailNavBar scrolled={scrolled} itemName={toTitleCase(place.name)} isSaved={isSaved} onSave={() => handleSaveItem(resolvedId, "adventure_place")} onBack={goBack} />
      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Only one gallery layout is ever mounted, based on actual screen size,
          so we never fetch images for the layout the person can't see. */}
      {isMobile ? (
        <MobileCarousel images={allImages} name={place.name} />
      ) : (
        <DesktopGallery images={allImages} name={place.name} />
      )}

      <main className="container px-4 mt-5 relative z-10 max-w-6xl mx-auto" style={{ fontFamily: FONT_BODY }}>
        {/* Single consistent order on every screen size now:
            Title/badges -> About -> Amenities -> (mobile booking card) ->
            Special Prices -> Facilities -> Activities -> Map.
            About sits directly under the name/location/category block and
            above Facilities/Activities, so the page's text content is ready
            before those image-heavy sections come into view. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-6">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-[28px] md:text-[34px] font-semibold leading-tight tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{toTitleCase(place.name)}</h1>
              <div className="flex items-center gap-1.5 mt-1.5" style={{ color: INK_SOFT }}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-[13px] font-medium">{[place.place, place.location, place.country].filter(Boolean).join(", ")}</span>
              </div>

              {/* Category + live Open now/Closed badges */}
              {(categoryLabel || isHotelOrCampsite) && (
                <div className="flex items-center gap-2 mt-3">
                  {categoryLabel && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: FOREST_SOFT, color: FOREST, border: `1px solid ${FOREST}25` }}
                    >
                      <CategoryIcon className="h-3 w-3" /> {categoryLabel}
                    </span>
                  )}
                  {isHotelOrCampsite && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full text-white"
                      style={{ background: isOpenNow ? OPEN_COLOR : CLOSED_COLOR }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                      {isOpenNow ? "Open now" : "Closed"}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* About this Place — moved up to sit right under the category
                badges, above Amenities/Facilities/Activities, on every
                screen size. */}
            {place.description && (
              <section className="bg-white rounded-2xl px-5 py-4.5" style={{ border: `1px solid ${HAIRLINE}` }}>
                <SectionHeading title="About this place" color={FOREST} />
                <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: INK }}>{place.description}</p>
              </section>
            )}

            {generalAmenities.length > 0 && (
              <AmenitiesScroll amenities={generalAmenities} accentColor={FOREST} />
            )}

            {/* Booking card — mobile only */}
            <div className="bg-white rounded-2xl p-5 lg:hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
              <BookingCard {...bookingCardProps} />
            </div>

            {specialPrices.length > 0 && <SpecialPricesSection tiers={specialPrices} formatPrice={formatPrice} />}

            {place.facilities?.length > 0 && <div id="facilities-section"><InlineFacilitiesGrid facilities={place.facilities} accentColor={FOREST} /></div>}
            {place.activities?.length > 0 && <div id="activities-section"><InlineActivitiesGrid activities={place.activities} formatPrice={formatPrice} /></div>}

            <AlwaysOpenMapSection name={place.name} latitude={place.latitude} longitude={place.longitude} location={place.location} country={place.country} />
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl p-6" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 30px rgba(28,43,34,0.06)" }}>
              <BookingCard {...bookingCardProps} />
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white" style={{ borderTop: `1px solid ${HAIRLINE}`, boxShadow: "0 -6px 24px rgba(28,43,34,0.08)", paddingBottom: "env(safe-area-inset-bottom, 0px)", fontFamily: FONT_BODY }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            {/* Free places show no price / label here at all — the bar just
                keeps the "Check availability" button, no "Free Entry" text. */}
            {place.entry_fee && place.entry_fee > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs" style={{ color: INK_SOFT }}>From</span>
                <span className="text-lg font-semibold" style={{ color: INK }}>{formatPrice(Number(place.entry_fee))}</span>
                <span className="text-xs" style={{ color: INK_SOFT }}>/ person</span>
              </div>
            ) : getStartingPrice() > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs" style={{ color: INK_SOFT }}>From</span>
                <span className="text-lg font-semibold" style={{ color: INK }}>{formatPrice(getStartingPrice())}</span>
              </div>
            ) : null}
          </div>
          <Button onClick={handleCheckAvailability} className="px-6 py-5 rounded-xl text-sm font-semibold text-white border-none" style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, ${CLAY} 100%)` }}>
            Check availability
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdventurePlaceDetail;