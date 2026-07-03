import React, { useState, memo, useCallback, useMemo, useRef } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart, Navigation } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ── Price label ─────────────────────────────────────────────────────────────
// Guided tours (isFlexibleDate && isTrip) show the tour's start time in UTC
// instead of a "/group" suffix, since group pricing isn't meaningful without
// knowing when the tour departs. Falls back to a plain "UTC" tag if no date
// is available yet.
const getPriceLabel = (isFlexibleDate: boolean, isTrip: boolean, date?: string) => {
  // TRIPS/GUIDED TOURS DISABLED — commented out, kept for reference
  // if (isFlexibleDate && isTrip) {
  //   if (date) {
  //     const utcTime = new Date(date).toLocaleTimeString("en-GB", {
  //       hour: "2-digit",
  //       minute: "2-digit",
  //       timeZone: "UTC",
  //     });
  //     return `${utcTime} UTC`;
  //   }
  //   return "UTC";
  // }
  return "/person";
};

// ── Category badge labels ────────────────────────────────────────────────────
// Color is intentionally not set per-category here — the badge always falls
// back to the same dark slate used by the "Guided tour" badge, so adventure
// place and guided tour badges read as one consistent visual language.
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  park: "Park",
  campsite: "Campsite",
  attraction: "Attraction",
  accommodation: "Accommodation",
};
const DEFAULT_CATEGORY_LABEL = "Campsite";

const PriceText = ({
  price,
  isUnavailable,
  isFlexibleDate,
  isTrip,
  date,
}: {
  price: number;
  isUnavailable: boolean;
  isFlexibleDate: boolean;
  isTrip: boolean;
  date?: string;
}) => {
  const { formatPrice } = useCurrency();
  return (
    <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")}>
      <span className="text-[10px] text-slate-500 font-medium">From</span>
      <span className="text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
        {formatPrice(price)}
      </span>
      <span className="text-[10px] text-slate-500 font-medium">
        {getPriceLabel(isFlexibleDate, isTrip, date)}
      </span>
    </div>
  );
};

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
  place?: string;
  showFlexibleDate?: boolean;
  description?: string;
  categoryColor?: string;
  galleryImages?: string[];
  images?: string[];
  openingHours?: string;
  closingHours?: string;
  // Days of the week the place is open, e.g. ["Mon","Tue","Wed"]. Used to
  // build the working-days line and to decide whether today counts as a
  // working day for the open/closed badge.
  workingDays?: string[];
}

// Canonical day order, used both for sorting and for collapsing consecutive
// days into a readable range (e.g. "Mon–Fri").
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Turns a list of day abbreviations into a compact, human-friendly string:
// all 7 days → "Every day", a run of consecutive days → "Mon–Fri", isolated
// days are comma-separated, e.g. "Mon–Fri, Sun".
const formatWorkingDays = (days: string[]): string | null => {
  if (!days || days.length === 0) return null;
  const present = DAY_ORDER.filter((d) => days.includes(d));
  if (present.length === 0) return null;
  if (present.length === 7) return "Every day";

  const ranges: string[] = [];
  let rangeStart = present[0];
  let prevIndex = DAY_ORDER.indexOf(present[0]);

  for (let i = 1; i <= present.length; i++) {
    const day = present[i];
    const dayIndex = day ? DAY_ORDER.indexOf(day) : -1;
    if (day && dayIndex === prevIndex + 1) {
      prevIndex = dayIndex;
      continue;
    }
    const rangeEnd = DAY_ORDER[prevIndex];
    ranges.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart}–${rangeEnd}`);
    if (day) {
      rangeStart = day;
      prevIndex = dayIndex;
    }
  }
  return ranges.join(", ");
};

const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, distance, workingDays,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(2);
  const [imageLoadStates, setImageLoadStates] = useState<Record<number, boolean>>({});
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const { ref: cardRef, isIntersecting } = useIntersectionObserver({ rootMargin: "300px", triggerOnce: true });
  const shouldLoad = priority || isIntersecting;

  const allSlideImages = useMemo(() => [imageUrl].filter(Boolean), [imageUrl]);
  const isTrip = false; // TRIPS DISABLED — was: type === "TRIP"
  const isAdventurePlace = type === "ADVENTURE PLACE";
  // const remainingTickets = availableTickets - bookedTickets; // TRIPS DISABLED
  // const isSoldOut = isTrip && availableTickets > 0 && remainingTickets <= 0; // TRIPS DISABLED
  // const fewSlotsRemaining = isTrip && remainingTickets > 0 && remainingTickets <= 10; // TRIPS DISABLED
  const remainingTickets = 0;
  const isSoldOut = false;
  const fewSlotsRemaining = false;
  const isUnavailable = isOutdated || isSoldOut;
  // const isGuidedTour = isFlexibleDate && isTrip; // TRIPS/GUIDED TOURS DISABLED
  const isGuidedTour = false;

  const categoryLabel = useMemo(() => {
    if (!isAdventurePlace) return null;
    return (category && CATEGORY_LABELS[category]) ?? DEFAULT_CATEGORY_LABEL;
  }, [isAdventurePlace, category]);

  const displayType = useMemo(() => {
    if (isAdventurePlace) return categoryLabel!;
    // TRIPS/GUIDED TOURS DISABLED — commented out, kept for reference
    // if (isGuidedTour) return "Guided tour";
    // if (isTrip) return "Trip";
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
  const locationString = useMemo(() => {
    const raw = [place, location].filter(Boolean).join(", ");
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }, [place, location]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      // TRIP: "trip", // TRIPS DISABLED
      "ADVENTURE PLACE": "adventure",
      ATTRACTION: "attraction",
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    // TRIPS/GUIDED TOURS DISABLED — sold out / few-slots badges only ever
    // applied to trips, so these branches are effectively dead now, but
    // left in place (commented) for when trips come back.
    // if (isSoldOut)
    //   return { text: "Sold out", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (isOutdated)
      return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    // if (fewSlotsRemaining)
    //   return { text: `${remainingTickets} left`, color: "bg-orange-50 text-orange-700 border-orange-200" };
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

  const workingDaysText = useMemo(
    () => (isAdventurePlace && workingDays ? formatWorkingDays(workingDays) : null),
    [isAdventurePlace, workingDays],
  );

  // Only hotels and campsites get a live "Open now / Closed" badge — other
  // categories (park, attraction, accommodation) don't have hours that are
  // meaningful to gate this way.
  const isHotelOrCampsite = category === "hotel" || category === "campsite";

  // Compares the device's current local day/time against openingHours,
  // closingHours, and workingDays. Handles overnight spans (e.g. opens
  // 18:00, closes 02:00) the same way hoursText does. Returns null when
  // there isn't enough data to decide.
  const isOpenNow = useMemo(() => {
    if (!isAdventurePlace || !isHotelOrCampsite) return null;
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
  }, [isAdventurePlace, isHotelOrCampsite, openingHours, closingHours, workingDays]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl border border-border shadow-sm",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "w-full",
        isUnavailable && "opacity-80",
      )}
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />

        {/* Category badge — top-left */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm text-white"
            style={{ backgroundColor: badgeColor ? `${badgeColor}E6` : "rgba(15,23,42,0.85)" }}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span className={cn("text-[9px] font-bold px-1.5 py-1 rounded-full border backdrop-blur-sm", urgencyBadge.color)}>
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
            <Heart className={cn("h-4 w-4 transition-colors", isSaved ? "fill-red-500 text-red-500" : "text-slate-600")} />
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
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
            <span className="rounded-md border border-white/60 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
              {isSoldOut ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}

        {/* Open/Closed badge — hotels and campsites only, based on opening
            hours, closing hours, and working days. Bottom-right of the image. */}
        {isOpenNow !== null && (
          <div className="absolute bottom-2.5 right-2.5 z-20">
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md shadow-sm text-white",
                isOpenNow ? "bg-green-600" : "bg-red-600",
              )}
            >
              {isOpenNow ? "Open now" : "Closed"}
            </span>
          </div>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-1.5 p-3 min-w-0">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
          {formattedName}
        </h3>

        {/* Location + rating, on one row so the card doesn't feel like a stack of separate facts */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 text-slate-500">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate">{locationString}</span>
          </div>
          {avgRating != null && avgRating > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                {avgRating.toFixed(1)}
              </span>
              {reviewCount != null && reviewCount > 0 && (
                <span className="text-[10px] text-slate-500">({reviewCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Secondary meta row: date / distance — only render what applies */}
        {/* TRIPS/GUIDED TOURS DISABLED — the trip date badge branch is commented
            out below; only distance still renders in this row. */}
        {(/* (isTrip && (date || isFlexibleDate)) || */ distanceText) ? (
          <div className="flex items-center gap-2.5 flex-wrap text-slate-500">
            {/* {isTrip && (date || isFlexibleDate) && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Calendar className="h-3 w-3" />
                {isFlexibleDate ? "Flexible" : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            )} */}
            {distanceText && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Navigation className="h-3 w-3" />
                {distanceText}
              </span>
            )}
          </div>
        ) : null}

        {/* Working hours — labeled block, adventure places only */}
        {isAdventurePlace && hoursText && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              Working hours
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
              <Clock className="h-3 w-3" />
              {hoursText}
            </span>
            {workingDaysText && (
              <span className="text-[10px] font-medium text-slate-500">{workingDaysText}</span>
            )}
          </div>
        )}

        {/* Price, anchored to the bottom of the card */}
        {!hidePrice && price != null && price > 0 && (
          <div className="pt-0.5">
            <PriceText price={price} isUnavailable={isUnavailable} isFlexibleDate={isFlexibleDate} isTrip={isTrip} date={date} />
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