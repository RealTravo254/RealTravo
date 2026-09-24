import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart, Navigation, BedDouble } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the detail, booking,
// and checkout pages: deep forest for structure and brand marks, a warm
// clay for the primary/favorited action, and a dry-grass gold reserved for
// caution states. Ink is a green-tinted charcoal rather than pure black.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const GOLD         = "#B98A2A";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const DANGER       = "#9C3B2B";
const DANGER_SOFT  = "#F7E9E5";
const SUCCESS      = "#2F6F4E";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the two typefaces once per page, without needing to touch the
// app's index.html. Guarded by element id, so it's cheap even though this
// hook runs in every card instance in a grid.
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

// ── Hotel starting price ─────────────────────────────────────────────────────
// Hotels have no entrance fee — their price lives on each room type inside
// the `facilities` JSON. Use this anywhere you need a hotel's "From" price
// (the card also calls it automatically when `facilities` is passed).
export const getHotelStartingPrice = (facilities?: any[] | null): number => {
  if (!Array.isArray(facilities)) return 0;
  const prices = facilities
    .map((f) => Number(f?.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : 0;
};

// ── Price label ─────────────────────────────────────────────────────────────
// Guided tours (isFlexibleDate && isTrip) show the tour's start time in UTC
// instead of a "/group" suffix, since group pricing isn't meaningful without
// knowing when the tour departs. Hotels are priced per night.
const getPriceLabel = (isFlexibleDate: boolean, isTrip: boolean, date?: string, isHotel = false) => {
  if (isHotel) return "/night";
  if (isFlexibleDate && isTrip) {
    if (date) {
      const utcTime = new Date(date).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      return `${utcTime} UTC`;
    }
    return "UTC";
  }
  return "/person";
};

// ── Category badge labels ────────────────────────────────────────────────────
// Color is intentionally not set per-category here — the badge always falls
// back to the same deep forest tint used by the "Guided tour" badge, so
// adventure place and guided tour badges read as one consistent visual
// language.
// NOTE: "accommodation" (Airbnb) intentionally has no label here — Airbnb
// listings are not surfaced in this card right now.
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  park: "Park",
  campsite: "Campsite",
  attraction: "Attraction",
};
const DEFAULT_CATEGORY_LABEL = "Campsite";

const PriceText = ({
  price,
  isUnavailable,
  isFlexibleDate,
  isTrip,
  date,
  isHotel = false,
}: {
  price: number;
  isUnavailable: boolean;
  isFlexibleDate: boolean;
  isTrip: boolean;
  date?: string;
  isHotel?: boolean;
}) => {
  const { formatPrice } = useCurrency();
  return (
    <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")} style={{ fontFamily: FONT_BODY }}>
      <span className="text-[12px] font-medium" style={{ color: INK_SOFT }}>From</span>
      <span className="text-base font-bold tabular-nums whitespace-nowrap" style={{ color: INK }}>
        {formatPrice(price)}
      </span>
      <span className="text-[12px] font-medium" style={{ color: INK_SOFT }}>
        {getPriceLabel(isFlexibleDate, isTrip, date, isHotel)}
      </span>
    </div>
  );
};

// ── Hotel star row ───────────────────────────────────────────────────────────
const HotelStars = ({ count }: { count: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${count}-star hotel`}>
    {Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="h-3.5 w-3.5" style={{ fill: GOLD, color: GOLD }} />
    ))}
  </div>
);

export interface ListingCardProps {
  id: string;
  type: "TRIP" | "ADVENTURE PLACE" | "ATTRACTION";
  category?: string;
  name: string;
  imageUrl: string;
  location: string;
  country: string;
  price?: number;
  date?: string;
  isCustomDate?: boolean;
  isFlexibleDate?: boolean;
  isOutdated?: boolean;
  onSave?: (id: string, type: string) => void;
  isSaved?: boolean;
  hideSave?: boolean;
  amenities?: string[];
  activities?: any[];
  hidePrice?: boolean;
  availableTickets?: number;
  bookedTickets?: number;
  showBadge?: boolean;
  priority?: boolean;
  minimalDisplay?: boolean;
  hideEmptySpace?: boolean;
  compact?: boolean;
  distance?: number;
  avgRating?: number;
  reviewCount?: number;
  // Legacy free-text area (used to hold the county). Only used as a fallback
  // when no division is available.
  place?: string;
  // Division / region name from `country_divisions` (via adventure_places.division_id).
  // Shown in place of the old county text.
  division?: string | null;
  showFlexibleDate?: boolean;
  description?: string;
  categoryColor?: string;
  galleryImages?: string[];
  images?: string[];
  // For hotels these are the check-in / check-out times.
  openingHours?: string;
  closingHours?: string;
  // Days of the week the place is open, e.g. ["Mon","Tue","Wed"]. Used to
  // build the working-days pill row and to decide whether today counts as a
  // working day for the open/closed badge. Not used for hotels.
  workingDays?: string[];
  // ── Hotel-only ──
  // Star rating (1–5) from the `star_rating` column.
  starRating?: number | null;
  // Room types from the `facilities` column. When `price` is 0/missing, the
  // card shows the cheapest room's nightly price as the "From" price.
  facilities?: any[] | null;
}

// Canonical day order, used both for sorting and for rendering the fixed
// Mon..Sun pill row (each day always renders — highlighted if open, dimmed
// with a strikethrough if closed).
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place, division,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, distance, workingDays,
  starRating, facilities,
}: ListingCardProps) => {
  useInjectFonts();

  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(2);
  const [imageLoadStates, setImageLoadStates] = useState<Record<number, boolean>>({});
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const { ref: cardRef, isIntersecting } = useIntersectionObserver({ rootMargin: "300px", triggerOnce: true });
  const shouldLoad = priority || isIntersecting;

  const allSlideImages = useMemo(() => [imageUrl].filter(Boolean), [imageUrl]);
  const isTrip = type === "TRIP";
  const isAdventurePlace = type === "ADVENTURE PLACE";
  const isHotel = isAdventurePlace && category === "hotel";
  const remainingTickets = availableTickets - bookedTickets;
  const isSoldOut = isTrip && availableTickets > 0 && remainingTickets <= 0;
  const fewSlotsRemaining = isTrip && remainingTickets > 0 && remainingTickets <= 10;
  const isUnavailable = isOutdated || isSoldOut;
  const isGuidedTour = isFlexibleDate && isTrip;

  // Hotels: price comes from the cheapest room type unless a price was passed in.
  const displayPrice = useMemo(() => {
    if (price != null && price > 0) return price;
    if (isHotel) return getHotelStartingPrice(facilities);
    return price ?? 0;
  }, [price, isHotel, facilities]);

  const stars = useMemo(() => {
    const n = Math.round(Number(starRating) || 0);
    return Math.max(0, Math.min(5, n));
  }, [starRating]);

  const categoryLabel = useMemo(() => {
    if (!isAdventurePlace) return null;
    return (category && CATEGORY_LABELS[category]) ?? DEFAULT_CATEGORY_LABEL;
  }, [isAdventurePlace, category]);

  const displayType = useMemo(() => {
    if (isAdventurePlace) return categoryLabel!;
    if (isGuidedTour) return "Guided tour";
    if (isTrip) return "Trip";
    return "Attraction";
  }, [isAdventurePlace, isGuidedTour, isTrip, categoryLabel]);

  // Same fallback color as the "Guided tour" badge (no categoryMeta color
  // lookup here anymore) so every badge type shares one visual language
  // unless the caller explicitly passes categoryColor.
  const badgeColor = categoryColor;

  // Proper title case once, rather than lowercase-then-CSS-capitalize fighting
  // each other (the original ran .toLowerCase() in JS then `capitalize` in
  // Tailwind, which only capitalizes the first letter of the whole string).
  const formattedName = useMemo(
    () => name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    [name],
  );
  // Division replaces the old county text; `place` is only a fallback for
  // listings that don't have a division yet.
  const locationString = useMemo(() => {
    const area = (division && division.trim()) || place;
    const raw = [area, location].filter(Boolean).join(", ");
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }, [division, place, location]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      TRIP: "trip",
      "ADVENTURE PLACE": "adventure",
      ATTRACTION: "attraction",
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    if (isSoldOut)
      return { text: "Sold out", style: { background: DANGER_SOFT, color: DANGER, borderColor: `${DANGER}40` } };
    if (isOutdated)
      return { text: "Passed", style: { background: "#F1F3EF", color: INK_SOFT, borderColor: HAIRLINE } };
    if (fewSlotsRemaining)
      return { text: `${remainingTickets} left`, style: { background: "#FBF2DD", color: "#8A6716", borderColor: `${GOLD}50` } };
    return null;
  }, [isSoldOut, isOutdated, fewSlotsRemaining, remainingTickets]);

  const goToSlide = useCallback(
    (index: number, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const maxIndex = Math.min(allSlideImages.length - 1, loadedSlides - 1);
      const newIndex = Math.max(0, Math.min(index, maxIndex));
      setCurrentSlide(newIndex);
      if (newIndex >= loadedSlides - 1 && loadedSlides < allSlideImages.length) {
        setLoadedSlides((prev) => Math.min(prev + 2, allSlideImages.length));
      }
    },
    [allSlideImages.length, loadedSlides],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) goToSlide(currentSlide + 1);
        else goToSlide(currentSlide - 1);
      }
    },
    [currentSlide, goToSlide],
  );

  const visibleDots = Math.min(loadedSlides, allSlideImages.length);

  // Parses "HH:MM" into minutes since midnight so we can measure the span
  // between opening and closing time, including overnight wraparound
  // (e.g. opens 06:00, closes 05:00 the next day).
  const parseTimeToMinutes = (t: string): number | null => {
    const match = t.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const hoursText = useMemo(() => {
    if (!openingHours && !closingHours) return null;
    const open = openingHours ?? "08:00";
    const close = closingHours ?? "18:00";

    const openMinutes = parseTimeToMinutes(open);
    const closeMinutes = parseTimeToMinutes(close);
    if (openMinutes != null && closeMinutes != null) {
      let spanMinutes = closeMinutes - openMinutes;
      if (spanMinutes <= 0) spanMinutes += 24 * 60;
      if (spanMinutes >= 23 * 60) return "Open 24 hours";
    }

    return `${open} – ${close}`;
  }, [openingHours, closingHours]);

  const distanceText = useMemo(() => {
    if (distance == null) return null;
    return distance < 1 ? `${Math.round(distance * 1000)} m away` : `${distance.toFixed(1)} km away`;
  }, [distance]);

  // Only campsites get a live "Open now / Closed" badge. Hotels are staffed
  // around the clock from a guest's point of view, and their two times are
  // check-in / check-out rather than opening hours, so they never show it.
  const isCampsite = category === "campsite";

  // Compares the device's current local day/time against openingHours,
  // closingHours, and workingDays. Handles overnight spans (e.g. opens
  // 18:00, closes 02:00) the same way hoursText does. Returns null when
  // there isn't enough data to decide.
  const isOpenNow = useMemo(() => {
    if (!isAdventurePlace || !isCampsite) return null;
    if (!openingHours || !closingHours) return null;

    const now = new Date();
    const dayAbbrev = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    if (workingDays && workingDays.length > 0 && !workingDays.includes(dayAbbrev)) {
      return false;
    }

    const openMinutes = parseTimeToMinutes(openingHours);
    const closeMinutes = parseTimeToMinutes(closingHours);
    if (openMinutes == null || closeMinutes == null) return null;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (closeMinutes <= openMinutes) {
      // Overnight span, e.g. 18:00 – 02:00
      return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    }
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }, [isAdventurePlace, isCampsite, openingHours, closingHours, workingDays]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl shadow-sm",
        "hover:shadow-lg hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "w-full",
        isUnavailable && "opacity-80",
      )}
      style={{
        border: `1px solid ${HAIRLINE}`,
        fontFamily: FONT_BODY,
        // @ts-ignore custom property consumed by the focus-visible ring utility above
        "--tw-ring-color": FOREST,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${CLAY}50`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIRLINE)}
    >
      {/* ── Image area ── */}
      <div
        className="relative w-full overflow-hidden aspect-[1/1] sm:aspect-[4/3]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={slideContainerRef}
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {allSlideImages.slice(0, loadedSlides).map((img, idx) => (
            <div key={idx} className="min-w-full h-full flex-shrink-0 relative">
              {!imageLoadStates[idx] && (
                <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              )}
              {shouldLoad && (
                <img
                  src={
                    img.includes("supabase.co/storage")
                      ? optimizeSupabaseImage(img, { width: 500, height: 375, quality: 80 })
                      : img
                  }
                  alt={`${formattedName}${idx > 0 ? ` – photo ${idx + 1}` : ""}`}
                  onLoad={() => setImageLoadStates((prev) => ({ ...prev, [idx]: true }))}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    if (t.src !== img) t.src = img;
                  }}
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-500 ease-out",
                    "group-hover:scale-[1.04]",
                    imageLoadStates[idx] ? "opacity-100" : "opacity-0",
                    isUnavailable && "grayscale-[0.5]",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrim so top badges stay legible on bright photos */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: "linear-gradient(to bottom, rgba(14,23,18,0.4), transparent)" }} />

        {/* Category badge — top-left */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-md shadow-sm text-white"
            style={{ backgroundColor: badgeColor ? `${badgeColor}E6` : `${FOREST_DEEP}E6`, fontFamily: FONT_BODY }}
          >
            {isHotel && <BedDouble className="h-3.5 w-3.5" />}
            {displayType}
          </span>
          {urgencyBadge && (
            <span className="text-[11px] font-semibold px-1.5 py-1 rounded-full border backdrop-blur-sm" style={urgencyBadge.style}>
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Save / heart button — top-right */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            aria-label={isSaved ? "Remove from saved" : "Save"}
            aria-pressed={isSaved}
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white active:scale-90 transition-all"
          >
            <Heart className="h-4 w-4 transition-colors" style={isSaved ? { fill: CLAY, color: CLAY } : { color: INK_SOFT }} />
          </button>
        )}

        {/* Desktop nav arrows */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4" style={{ color: INK }} />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-4 w-4" style={{ color: INK }} />
              </button>
            )}
          </>
        )}

        {/* Dot indicators */}
        {allSlideImages.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
            {Array.from({ length: visibleDots }).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => goToSlide(idx, e)}
                aria-label={`Go to photo ${idx + 1}`}
                className={cn(
                  "rounded-full transition-all",
                  idx === currentSlide ? "w-2 h-2 bg-white shadow-md" : "w-1.5 h-1.5 bg-white/60",
                )}
              />
            ))}
            {loadedSlides < allSlideImages.length && (
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            )}
          </div>
        )}

        {/* Sold-out / unavailable overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]" style={{ background: "rgba(14,23,18,0.5)" }}>
            <span className="rounded-md border border-white/60 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-white">
              {isSoldOut ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}

        {/* Open/Closed badge — campsites only, based on opening hours,
            closing hours, and working days. Bottom-right of the image. */}
        {isOpenNow !== null && (
          <div className="absolute bottom-2.5 right-2.5 z-20">
            <span
              className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md shadow-sm text-white"
              style={{ background: isOpenNow ? SUCCESS : DANGER }}
            >
              {isOpenNow ? "Open now" : "Closed"}
            </span>
          </div>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-2 p-3.5 min-w-0">
        {/* Title */}
        <h3 className="line-clamp-2 text-[18px] font-semibold leading-snug" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
          {formattedName}
        </h3>

        {/* Hotel star classification, directly under the name */}
        {isHotel && stars > 0 && <HotelStars count={stars} />}

        {/* Location + rating, on one row so the card doesn't feel like a stack of separate facts */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0" style={{ color: INK_SOFT }}>
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-[13px] font-medium truncate">{locationString}</span>
          </div>
          {avgRating != null && avgRating > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="h-3.5 w-3.5" style={{ fill: GOLD, color: GOLD }} />
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: INK }}>
                {avgRating.toFixed(1)}
              </span>
              {reviewCount != null && reviewCount > 0 && (
                <span className="text-[12px]" style={{ color: INK_SOFT }}>({reviewCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Secondary meta row: date / distance — only render what applies */}
        {((isTrip && (date || isFlexibleDate)) || distanceText) ? (
          <div className="flex items-center gap-2.5 flex-wrap" style={{ color: INK_SOFT }}>
            {isTrip && (date || isFlexibleDate) && (
              <span className="flex items-center gap-1 text-[12px] font-medium">
                <Calendar className="h-3.5 w-3.5" />
                {isFlexibleDate ? "Flexible" : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            )}
            {distanceText && (
              <span className="flex items-center gap-1 text-[12px] font-medium">
                <Navigation className="h-3.5 w-3.5" />
                {distanceText}
              </span>
            )}
          </div>
        ) : null}

        {/* Hotel stay times — check-in / check-out replace the working-hours block */}
        {isHotel && (openingHours || closingHours) && (
          <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color: INK_SOFT }}>
            <Clock className="h-3.5 w-3.5" />
            <span>
              {openingHours && <>Check-in {openingHours}</>}
              {openingHours && closingHours && <span className="mx-1">·</span>}
              {closingHours && <>Check-out {closingHours}</>}
            </span>
          </div>
        )}

        {/* Working hours — labeled block, non-hotel adventure places only. Shows
            the hours range plus a fixed Mon..Sun pill row: open days
            highlighted, closed days dimmed with a strikethrough. */}
        {isAdventurePlace && !isHotel && hoursText && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9CA8A0" }}>
              Working hours
            </span>
            <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: INK_SOFT }}>
              <Clock className="h-3.5 w-3.5" />
              {hoursText}
            </span>
            {workingDays && workingDays.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {DAY_ORDER.map((day) => {
                  const isOpenDay = workingDays.includes(day);
                  return (
                    <span
                      key={day}
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={
                        isOpenDay
                          ? { background: FOREST_SOFT, color: FOREST }
                          : { background: "#F1F3EF", color: "#A7B2AB", textDecoration: "line-through", textDecorationColor: "#C7D0CB" }
                      }
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Price, anchored to the bottom of the card */}
        {!hidePrice && displayPrice > 0 && (
          <div className="pt-0.5">
            <PriceText price={displayPrice} isUnavailable={isUnavailable} isFlexibleDate={isFlexibleDate} isTrip={isTrip} date={date} isHotel={isHotel} />
          </div>
        )}
      </div>
    </Card>
  );
};

export const ListingCard = memo(
  React.forwardRef<HTMLDivElement, ListingCardProps>((props, ref) => (
    <ListingCardComponent {...props} />
  )),
); 
ListingCard.displayName = "ListingCard";