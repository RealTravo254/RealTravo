import React, { useState, memo, useCallback, useMemo, useRef } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart, Timer } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ── Helpers ───────────────────────────────────────────────────────────────────
const getPriceLabel = (isFlexibleDate: boolean, isTrip: boolean) => {
  if (isFlexibleDate && isTrip) return "";
  return "/person";
};

const CATEGORY_LABELS: Record<string, string> = {
  hotel:         "Hotel",
  park:          "Park",
  campsite:      "Campsite",
  attraction:    "Attraction",
  accommodation: "Accommodation",
};

const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// Abbreviate working day names → 3-letter uppercase
const DAY_ABBR: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const abbreviateDay = (d: string) => DAY_ABBR[d.toLowerCase()] ?? d.slice(0, 3);

// Collapse consecutive days into ranges: ["Mon","Tue","Wed","Fri"] → "Mon–Wed, Fri"
const formatWorkingDays = (days: string[]): string => {
  if (!days || days.length === 0) return "";
  const ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const abbr = days.map(abbreviateDay);
  const sorted = [...new Set(abbr)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (sorted.length === 7) return "Every day";

  const groups: string[][] = [];
  let current: string[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (ORDER.indexOf(sorted[i]) === ORDER.indexOf(current[current.length - 1]) + 1) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);

  return groups.map(g => g.length >= 3 ? `${g[0]}–${g[g.length - 1]}` : g.join(", ")).join(", ");
};

// ── Types ─────────────────────────────────────────────────────────────────────
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
  durationMinutes?: number;
  /** Days the adventure place is open e.g. ["Mon","Tue","Wed","Thu","Fri"] */
  daysOpened?: string[];
}

// ── Component ─────────────────────────────────────────────────────────────────
const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, durationMinutes, galleryImages, images,
  daysOpened,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(2);
  const [imageLoadStates, setImageLoadStates] = useState<Record<number, boolean>>({});
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const { ref: cardRef, isIntersecting } = useIntersectionObserver({ rootMargin: "300px", triggerOnce: true });
  const shouldLoad = priority || isIntersecting;

  const allSlideImages = useMemo(() => {
    const combined = [imageUrl, ...(galleryImages || []), ...(images || [])];
    return Array.from(new Set(combined.filter(Boolean)));
  }, [imageUrl, galleryImages, images]);

  const isTrip = type === "TRIP";
  const isAdventurePlace = type === "ADVENTURE PLACE";

  const remainingTickets = availableTickets - bookedTickets;
  const isSoldOut = isTrip && availableTickets > 0 && remainingTickets <= 0;
  const fewSlotsRemaining = isTrip && remainingTickets > 0 && remainingTickets <= 10;
  const isUnavailable = isOutdated || isSoldOut;
  const isGuidedTour = isFlexibleDate && isTrip;

  const displayType = useMemo(() => {
    if (isAdventurePlace) return (category && CATEGORY_LABELS[category]) ?? "Campsite";
    if (isGuidedTour) return "Guided Tour";
    if (isTrip) return "Trip";
    return "Attraction";
  }, [isAdventurePlace, isGuidedTour, isTrip, category]);

  const formattedName = useMemo(
    () => name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    [name],
  );

  const locationString = useMemo(
    () => [place, location].filter(Boolean).join(", "),
    [place, location],
  );

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      TRIP: "trip",
      "ADVENTURE PLACE": "adventure",
      ATTRACTION: "attraction",
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    if (isSoldOut)         return { text: "Sold out",              bg: "bg-red-500" };
    if (isOutdated)        return { text: "Passed",                bg: "bg-slate-500" };
    if (fewSlotsRemaining) return { text: `🔥 ${remainingTickets} left`, bg: "bg-orange-500" };
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

  // ── Working hours display ──────────────────────────────────────────────────
  // Returns "Open 24 Hours" for full-day places, otherwise "HH:MM – HH:MM UTC"
  const workingHoursDisplay = useMemo(() => {
    if (!openingHours && !closingHours) return null;

    const start = openingHours ?? "08:00";
    const end   = closingHours  ?? "18:00";

    const [startH] = start.split(":").map(Number);
    const [endH]   = end.split(":").map(Number);

    if (!isNaN(startH) && !isNaN(endH)) {
      let durationHours = endH - startH;
      if (durationHours < 0) durationHours += 24;
      if (durationHours >= 23) return "Open 24 Hours";
    }

    return `${start} – ${end} UTC`;
  }, [openingHours, closingHours]);

  // ── Working days display ───────────────────────────────────────────────────
  const workingDaysDisplay = useMemo(() => {
    if (!isAdventurePlace) return null;
    if (!daysOpened || daysOpened.length === 0) return null;
    return formatWorkingDays(daysOpened);
  }, [isAdventurePlace, daysOpened]);

  const durationText = useMemo(
    () => (durationMinutes ? formatDuration(durationMinutes) : null),
    [durationMinutes],
  );

  const { formatPrice } = useCurrency();
  const accentColor = categoryColor ?? "#008080";

  const hasMetaContent =
    (isTrip && date) ||
    isGuidedTour ||
    durationText ||
    workingHoursDisplay ||
    workingDaysDisplay;

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer",
        "rounded-2xl bg-white shadow-md border border-slate-200",
        "hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200",
        "w-full xs:min-w-[290px] h-full min-h-[340px]",
        isUnavailable && "opacity-75",
      )}
    >
      {/* ── Image Section ── */}
      <div
        className="relative w-full overflow-hidden flex-[1.4]"
        style={{ aspectRatio: "16/10" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={slideContainerRef}
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {allSlideImages.slice(0, loadedSlides).map((img, idx) => (
            <div key={idx} className="min-w-full h-full flex-shrink-0 relative bg-slate-100">
              {!imageLoadStates[idx] && (
                <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
              )}
              {shouldLoad && (
                <img
                  src={
                    img.includes("supabase.co/storage")
                      ? optimizeSupabaseImage(img, { width: 600, height: 450, quality: 85 })
                      : img
                  }
                  alt={`${name} - ${idx + 1}`}
                  onLoad={() => setImageLoadStates((prev) => ({ ...prev, [idx]: true }))}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    if (t.src !== img) t.src = img;
                  }}
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    imageLoadStates[idx] ? "opacity-100" : "opacity-0",
                    isUnavailable && "grayscale-[0.4]",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10" />

        {/* Type badge */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1">
          <span
            className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded shadow text-white"
            style={{ backgroundColor: accentColor }}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span className={cn("text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow", urgencyBadge.bg)}>
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Heart */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2.5 right-2.5 z-20 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            <Heart className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", isSaved ? "fill-red-500 text-red-500" : "text-slate-500")} />
          </button>
        )}

        {/* Duration pill */}
        {durationText && (
          <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1">
            <Timer className="h-3 w-3 text-white" />
            <span className="text-[10px] sm:text-[11px] font-bold text-white leading-none">{durationText}</span>
          </div>
        )}

        {/* Rating pill */}
        {avgRating != null && avgRating > 0 && (
          <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-0.5 shadow">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] sm:text-[11px] font-black text-slate-800 leading-none">{avgRating.toFixed(1)}</span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[8px] sm:text-[9px] font-semibold text-slate-500">({reviewCount})</span>
            )}
          </div>
        )}

        {/* Slide arrows */}
        {allSlideImages.length > 1 && currentSlide > 0 && (
          <button
            onClick={(e) => goToSlide(currentSlide - 1, e)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
        )}
        {allSlideImages.length > 1 && currentSlide < visibleDots - 1 && (
          <button
            onClick={(e) => goToSlide(currentSlide + 1, e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        )}

        {/* Dot indicators */}
        {allSlideImages.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
            {Array.from({ length: visibleDots }).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => goToSlide(idx, e)}
                className={cn(
                  "rounded-full transition-all",
                  idx === currentSlide ? "w-2 h-2 bg-white shadow" : "w-1.5 h-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
        )}

        {/* Unavailable overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-lg border border-white/70 px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase text-white tracking-wider">
              {isSoldOut ? "Sold Out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Info Panel ── */}
      <div className="flex flex-col p-3 gap-2 bg-white flex-1 justify-between">

        {/* Top block: name + location */}
        <div className="flex flex-col gap-1">
          <h3 className="font-black text-slate-900 leading-tight line-clamp-2 text-[12px] sm:text-[13px] tracking-tight sm:tracking-[-0.01em]">
            {formattedName}
          </h3>

          {locationString.trim().length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" style={{ color: accentColor }} />
              <span
                className="text-[10px] sm:text-[11px] font-bold truncate capitalize"
                style={{ color: "#1e293b" }}
              >
                {locationString.toLowerCase()}
              </span>
            </div>
          )}
        </div>

        {/* Bottom block: price + meta */}
        <div className="flex flex-col gap-1 mt-auto pt-1">
          {!hidePrice && price != null && price > 0 && (
            <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")}>
              <span
                className="font-black leading-none text-sm sm:text-[15px]"
                style={{ color: accentColor }}
              >
                {isFlexibleDate && isTrip ? `From ${formatPrice(price)}` : formatPrice(price)}
              </span>
              {!(isFlexibleDate && isTrip) && (
                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500">
                  {getPriceLabel(isFlexibleDate, isTrip)}
                </span>
              )}
            </div>
          )}

          {hasMetaContent && (
            <div className="flex flex-col gap-1">

              {/* Trip date / flexible */}
              {isTrip && date && !isFlexibleDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">
                    {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} UTC
                  </span>
                </div>
              )}
              {isTrip && isFlexibleDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">Flexible</span>
                </div>
              )}

              {/* Duration */}
              {durationText && (
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">{durationText}</span>
                </div>
              )}

              {/* Adventure Place: Opening & Closing hours */}
              {isAdventurePlace && workingHoursDisplay && (
                <div className="flex items-start gap-1">
                  <Clock className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hours (UTC)</span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                      {workingHoursDisplay}
                    </span>
                  </div>
                </div>
              )}

              {/* Adventure Place: Working days */}
              {isAdventurePlace && workingDaysDisplay && (
                <div className="flex items-start gap-1">
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Open</span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700">
                      {workingDaysDisplay}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ListingCard = memo(
  React.forwardRef<HTMLDivElement, ListingCardProps>((props, _ref) => (
    <ListingCardComponent {...props} />
  )),
);
ListingCard.displayName = "ListingCard";