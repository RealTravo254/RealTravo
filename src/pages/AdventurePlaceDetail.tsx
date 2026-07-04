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
  Globe, Sparkles, Info,
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

const TEAL        = "#008080";
const CORAL       = "#FF7F50";
const CORAL_LIGHT = "#FF9E7A";

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

// ── Category badge labels ────────────────────────────────────────────────────
// Mirrors the same mapping used on ListingCard so the "Hotel" / "Campsite" /
// etc. wording is consistent between the listing grids and this detail page.
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  park: "Park",
  campsite: "Campsite",
  attraction: "Attraction",
  accommodation: "Accommodation",
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
        position: "fixed", inset: 0, background: "#000000",
        display: "flex", flexDirection: "column",
        zIndex: 2147483647,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700 }}>
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
                style={{ flexShrink: 0, width: 56, height: 42, padding: 0, border: idx === current ? `2px solid ${CORAL}` : "2px solid rgba(255,255,255,0.22)", borderRadius: 8, outline: "none", opacity: idx === current ? 1 : 0.5, cursor: "pointer", overflow: "hidden", boxSizing: "border-box", transition: "opacity 0.15s, border-color 0.15s" }}
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
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div
          className="rounded-2xl overflow-hidden border-2 border-black/[0.08]"
          style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gridTemplateRows: "200px 130px", gap: "3px" }}
        >
          {/* Only the 3 visible thumbnails are fetched — the rest stay unloaded until "see all" is opened */}
          <div style={{ gridRow: "1 / 3", overflow: "hidden", cursor: "pointer" }} onClick={() => open(0)}>
            <img src={images[0]} alt={name} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
          <div style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => open(1)}>
            {images[1] ? <img src={images[1]} alt={`${name} 2`} loading="eager" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-slate-200" />}
          </div>
          <div style={{ overflow: "hidden", position: "relative", cursor: "pointer" }} onClick={() => open(2)}>
            {images[2] ? <img src={images[2]} alt={`${name} 3`} loading="eager" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
            {images.length > 3 && (
              <div className="absolute inset-0 bg-black/52 flex items-center justify-center backdrop-blur-[1px]">
                <div className="text-center">
                  <span className="text-white text-2xl font-black">+{images.length - 3}</span>
                  <p className="text-white text-[10px] font-medium normal-case tracking-tight mt-0.5">see all</p>
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
// No border radius on the image container on small screens (per request).
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
    <div className="w-full bg-slate-200 flex items-center justify-center text-slate-400 font-black uppercase text-xs" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>
      No Image
    </div>
  );

  return (
    <>
      {modalOpen && <ImageGalleryModal images={images} name={name} startIndex={modalStart} onClose={() => setModalOpen(false)} />}
      <div className="relative overflow-hidden bg-slate-900" style={{ height: "45vh", minHeight: "200px", maxHeight: "360px" }}>
        <img
          key={active}
          src={images[active]}
          alt={`${name} ${active + 1}`}
          loading="eager"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
        {images.length > 1 && (
          <>
            <button onClick={() => go(active - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => go(active + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
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
            <button onClick={() => { setModalStart(active); setModalOpen(true); }} className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium normal-case px-2.5 py-1 rounded-full hover:bg-black/70 transition-all">
              <Grid2X2 className="h-3 w-3" /> see all
            </button>
          )}
          <div className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">{active + 1} / {images.length}</div>
        </div>
      </div>
    </>
  );
};

// ─── General Amenities ────────────────────────────────────────────────────────
const AmenitiesScroll = ({ amenities, accentColor }: { amenities: string[]; accentColor: string }) => {
  if (!amenities.length) return null;
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: accentColor }}>General Amenities</h2>
      <div className="flex flex-wrap gap-1.5">
        {amenities.map((fId, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full border" style={{ background: `${accentColor}10`, borderColor: `${accentColor}30` }}>
            <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-[9px] font-bold uppercase tracking-tight whitespace-nowrap" style={{ color: accentColor }}>{facilityLabel(fId)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const CARD_IMG_HEIGHT = 100;

// Facility card image height stays fixed at every breakpoint — the card
// grows by getting WIDER on large screens (fewer grid columns), not taller.
const FACILITY_IMG_HEIGHT_CLASS = "h-[100px]";

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
      <section>
        <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: accentColor }}>Facilities</h2>
        {/* Fewer columns on large screens (3 instead of 5) so each card gets
            noticeably WIDER — image height stays fixed, only the card's
            width (and the image filling it) grows. */}
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-3 md:overflow-visible md:pb-0 lg:gap-4">
          {visibleFacilities.map((fac: any, i: number) => {
            const imgs: string[] = Array.isArray(fac.images) ? fac.images.filter(Boolean) : [];
            // "see all" only shows up when there's actually more than one photo to see
            const hasMultiple = imgs.length > 1;
            return (
              <div key={i} className="bg-white overflow-hidden shadow-sm border border-slate-100 flex-shrink-0 w-[150px] md:w-auto rounded-xl">
                {imgs.length > 0 ? (
                  <div className={`relative overflow-hidden ${FACILITY_IMG_HEIGHT_CLASS}`}>
                    <FacImage images={imgs} name={fac.name} onClick={() => openCardGallery(imgs, fac.name, 0)} />
                    {hasMultiple && (
                      <button onClick={(e) => { e.stopPropagation(); openCardGallery(imgs, fac.name, 0); }} className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-white text-[8px] lg:text-[10px] font-medium normal-case px-1.5 py-0.5 rounded-full hover:bg-black/70 transition-all">
                        <Grid2X2 className="h-2 w-2 lg:h-2.5 lg:w-2.5" /> see all
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center justify-center bg-slate-100 ${FACILITY_IMG_HEIGHT_CLASS}`}>
                    <MapPin className="h-5 w-5 lg:h-7 lg:w-7 text-slate-300" />
                  </div>
                )}
                <div className="p-2 lg:p-3.5">
                  <p className="font-black text-[11px] lg:text-sm text-slate-800 uppercase tracking-tight leading-tight">{fac.name}</p>
                  {fac.capacity && <p className="text-[9px] lg:text-xs text-slate-500 mt-0.5 flex items-center gap-0.5"><Users className="h-2.5 w-2.5 lg:h-3.5 lg:w-3.5" /> {fac.capacity}</p>}
                  {fac.price > 0 && <p className="text-[10px] lg:text-sm font-bold mt-0.5" style={{ color: accentColor }}>KSh {fac.price?.toLocaleString()}</p>}
                  {Array.isArray(fac.amenities) && fac.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 lg:gap-1 mt-1 lg:mt-2">
                      {fac.amenities.slice(0, 5).map((a: any, ai: number) => (
                        // Amenity name shown in dark grey (not the accent color) for
                        // better readability and to keep the accent color reserved
                        // for prices / headings.
                        <span
                          key={ai}
                          className="text-[8px] lg:text-[10px] font-bold px-1.5 lg:px-2 py-0.5 rounded normal-case text-slate-600"
                          style={{ background: `${accentColor}12` }}
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
          <div className="flex items-center justify-center gap-3 mt-3">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous facilities" className="w-7 h-7 rounded-full flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} aria-label="Next facilities" className="w-7 h-7 rounded-full flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: `${accentColor}40`, color: accentColor }}>
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
    <div className="bg-white overflow-hidden shadow-sm border border-slate-100 rounded-xl">
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
          <div className="absolute inset-0 bg-slate-200 flex items-center justify-center"><MapPin className="h-5 w-5 text-slate-300" /></div>
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }} />
        {/* "see all" only appears when this activity actually has more than one photo */}
        {hasMultiple && (
          <button onClick={(e) => { e.stopPropagation(); onImageClick?.(); }} className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-white text-[8px] font-medium normal-case px-1.5 py-0.5 rounded-full hover:bg-black/70 transition-all">
            <Grid2X2 className="h-2 w-2" /> see all
          </button>
        )}
      </div>
      <div className="p-2">
        <p className="font-black text-[11px] text-slate-800 uppercase tracking-tight leading-tight">{act.name}</p>
        {act.price > 0 ? (
          <p className="text-[10px] font-bold mt-0.5" style={{ color: CORAL }}>{formatPrice(Number(act.price))}</p>
        ) : (
          <p className="text-[10px] font-bold mt-0.5 text-emerald-600">Free</p>
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
      <section>
        <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: CORAL }}>Activities</h2>
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible md:pb-0">
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
          <div className="flex items-center justify-center gap-3 mt-3">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous activities" className="w-7 h-7 rounded-full flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: `${CORAL}40`, color: CORAL }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} aria-label="Next activities" className="w-7 h-7 rounded-full flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: `${CORAL}40`, color: CORAL }}>
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
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#a855f718" }}>
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
        </div>
        <h2 className="text-base font-black uppercase tracking-tight text-purple-600">Special Entry Prices</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiers.map((tier, i) => (
          <div key={tier.id ?? i} className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5">
            <p className="font-black text-sm text-slate-800 uppercase tracking-tight">{tier.label}</p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mt-1.5">
              <span className="text-sm font-bold text-purple-600">
                {formatPrice(Number(tier.citizen_price) || 0)}{" "}
                <span className="text-[10px] text-slate-400 font-semibold normal-case">citizen</span>
              </span>
              {tier.non_citizen_price != null && Number(tier.non_citizen_price) > 0 && (
                <span className="text-sm font-bold text-amber-600">
                  {formatPrice(Number(tier.non_citizen_price))}{" "}
                  <span className="text-[10px] text-slate-400 font-semibold normal-case">non-citizen</span>
                </span>
              )}
            </div>
            {tier.requirement?.trim() && (
              <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-purple-100">
                <Info className="h-3 w-3 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-500 leading-snug">{tier.requirement}</p>
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
    <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: TEAL }} />
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight" style={{ color: TEAL }}>Location</h2>
            <p className="text-[10px] text-slate-400 font-medium">{[name, location, country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-[10px] font-bold transition-all hover:opacity-90 active:scale-95" style={{ background: `linear-gradient(135deg, ${TEAL}, #005f5f)` }}>
          <ExternalLink className="h-3 w-3" /> View on Google Maps
        </a>
      </div>
      <div style={{ height: "300px", position: "relative" }}>
        <iframe title={`Map of ${name}`} src={embedUrl} width="100%" height="100%" style={{ border: 0, display: "block" }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-3 py-1.5 pointer-events-none">
          <MapPin className="h-3 w-3" style={{ color: CORAL }} />
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{name}</span>
        </div>
      </div>
    </section>
  );
};

const UtilityButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <Button variant="ghost" onClick={onClick} className="flex-col h-auto py-2.5 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors flex-1">
    <div className="mb-0.5">{icon}</div>
    <span className="text-[9px] font-bold uppercase">{label}</span>
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
    <>
      {/* ── Pricing: only rendered when entry is actually paid. Free places
          skip this block entirely — no "Free Entry" label is shown anywhere
          on the page, per product request. ── */}
      {isPaid && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-200">
            {/* Citizen column */}
            <div className="p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Citizen</p>
              <p className="text-sm font-black text-slate-800">{formatPrice(Number(place.entry_fee))}</p>
              {Number(place.child_entry_fee) > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">Child: {formatPrice(Number(place.child_entry_fee))}</p>
              )}
            </div>
            {/* Non-citizen column */}
            <div className="p-3" style={{ background: hasNonCitizen ? "#FFFBEB" : undefined }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" /> Non-Citizen
              </p>
              {hasNonCitizen ? (
                <>
                  <p className="text-sm font-black text-amber-700">{formatPrice(Number(place.non_citizen_entry_fee))}</p>
                  {Number(place.non_citizen_child_entry_fee) > 0 && (
                    <p className="text-[10px] text-amber-600 mt-0.5">Child: {formatPrice(Number(place.non_citizen_child_entry_fee))}</p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-slate-400 font-semibold">Same as citizen</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hours & days */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Hours
          </span>
          <span className="text-xs font-black text-slate-700">
            {is24Hours ? "Open 24 Hours" : `${place.opening_hours || "08:00"} – ${place.closing_hours || "18:00"}`}
          </span>
        </div>
        {daysOpened.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Available Days</p>
            <div className="flex flex-wrap gap-1">
              {daysOpened.map((day, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border" style={{ background: `${TEAL}12`, color: TEAL, borderColor: `${TEAL}30` }}>{day}</span>
              ))}
            </div>
          </div>
        )}
        {capacityPerDay != null && capacityPerDay > 0 && (
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
              <Users className="h-3 w-3" /> Daily Capacity
            </span>
            <span className="text-xs font-black text-slate-700">{capacityPerDay} guests</span>
          </div>
        )}
      </div>

      <Button
        onClick={onCheckAvailability}
        className="w-full py-6 rounded-xl text-sm font-bold text-white border-none shadow-md transition-all active:scale-95"
        style={{ background: `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}
      >
        Check availability
      </Button>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <UtilityButton icon={<Navigation className="h-4 w-4" />} label="Map" onClick={onMap} />
        <UtilityButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={onCopy} />
        <UtilityButton icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} />
      </div>
    </>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const AdventurePlaceDetail = () => {
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-lg font-black uppercase text-slate-500">Place not found</p>
      <Button onClick={() => navigate(-1)} className="rounded-full bg-teal-600 text-white border-none">Go Back</Button>
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
      toast({ title: "Link Copied!" });
    },
    onShare: async () => {
      const link = getShareLink(resolvedId, "adventure_place", place.name, place.location);
      if (navigator.share) { try { await navigator.share({ title: place.name, url: link }); } catch {} }
      else { await navigator.clipboard.writeText(link); toast({ title: "Link Copied!" }); }
    },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <DetailNavBar scrolled={scrolled} itemName={toTitleCase(place.name)} isSaved={isSaved} onSave={() => handleSaveItem(resolvedId, "adventure_place")} onBack={goBack} />
      <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />

      {/* Only one gallery layout is ever mounted, based on actual screen size,
          so we never fetch images for the layout the person can't see. */}
      {isMobile ? (
        <MobileCarousel images={allImages} name={place.name} />
      ) : (
        <DesktopGallery images={allImages} name={place.name} />
      )}

      <main className="container px-4 mt-4 relative z-10 max-w-6xl mx-auto">
        {/* Single consistent order on every screen size now:
            Title/badges -> About -> Amenities -> (mobile booking card) ->
            Special Prices -> Facilities -> Activities -> Map.
            About sits directly under the name/location/category block and
            above Facilities/Activities, so the page's text content is ready
            before those image-heavy sections come into view. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr,1fr] gap-6">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-tight text-foreground">{toTitleCase(place.name)}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-sm font-semibold">{[place.place, place.location, place.country].filter(Boolean).join(", ")}</span>
              </div>

              {/* Category + live Open now/Closed badges */}
              {(categoryLabel || isHotelOrCampsite) && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  {categoryLabel && (
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-sm"
                      style={{ background: TEAL }}
                    >
                      {categoryLabel}
                    </span>
                  )}
                  {isHotelOrCampsite && (
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-sm ${isOpenNow ? "bg-green-600" : "bg-red-600"}`}
                    >
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
              <section className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100">
                <h2 className="text-base font-black uppercase tracking-tight mb-3" style={{ color: TEAL }}>About this Place</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{place.description}</p>
              </section>
            )}

            {generalAmenities.length > 0 && (
              <AmenitiesScroll amenities={generalAmenities} accentColor={TEAL} />
            )}

            {/* Booking card — mobile only */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 lg:hidden">
              <BookingCard {...bookingCardProps} />
            </div>

            {specialPrices.length > 0 && <SpecialPricesSection tiers={specialPrices} formatPrice={formatPrice} />}

            {place.facilities?.length > 0 && <div id="facilities-section"><InlineFacilitiesGrid facilities={place.facilities} accentColor={TEAL} /></div>}
            {place.activities?.length > 0 && <div id="activities-section"><InlineActivitiesGrid activities={place.activities} formatPrice={formatPrice} /></div>}

            <AlwaysOpenMapSection name={place.name} latitude={place.latitude} longitude={place.longitude} location={place.location} country={place.country} />
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 space-y-4">
              <BookingCard {...bookingCardProps} />
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgb(0,0,0,0.08)]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            {/* Free places show no price / label here at all — the bar just
                keeps the "Check availability" button, no "Free Entry" text. */}
            {place.entry_fee && place.entry_fee > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-slate-500">From</span>
                <span className="text-lg font-black text-slate-900">{formatPrice(Number(place.entry_fee))}</span>
                <span className="text-xs text-slate-500">/ person</span>
              </div>
            ) : getStartingPrice() > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-slate-500">From</span>
                <span className="text-lg font-black text-slate-900">{formatPrice(getStartingPrice())}</span>
              </div>
            ) : null}
          </div>
          <Button onClick={handleCheckAvailability} className="px-6 py-5 rounded-xl text-sm font-bold text-white border-none" style={{ background: `linear-gradient(135deg, ${CORAL_LIGHT} 0%, ${CORAL} 100%)` }}>
            Check availability
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdventurePlaceDetail;