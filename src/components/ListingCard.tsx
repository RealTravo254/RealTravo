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
const getPriceLabel = (isFlexibleDate: boolean, isTrip: boolean) => {
  if (isFlexibleDate && isTrip) return "/group";
  return "/person";
};

// ── Category badge labels + fallback color per category ─────────────────────
// Falls back to a deliberate palette instead of the old ternary
// (text-primary-foreground bg-primary/90) so every category still reads
// intentionally even without a categoryColor prop from the caller.
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  hotel: { label: "Hotel", color: "#2563EB" },
  park: { label: "Park", color: "#16A34A" },
  campsite: { label: "Campsite", color: "#B45309" },
  attraction: { label: "Attraction", color: "#7C3AED" },
  accommodation: { label: "Accommodation", color: "#0F766E" },
};
const DEFAULT_CATEGORY_META = { label: "Campsite", color: "#0F766E" };

const PriceText = ({
  price,
  isUnavailable,
  isFlexibleDate,
  isTrip,
}: {
  price: number;
  isUnavailable: boolean;
  isFlexibleDate: boolean;
  isTrip: boolean;
}) => {
  const { formatPrice } = useCurrency();
  return (
    <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")}>
      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums whitespace-nowrap">
        {formatPrice(price)}
      </span>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
        {getPriceLabel(isFlexibleDate, isTrip)}
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
}

const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, distance,
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
  const isTrip = type === "TRIP";
  const isAdventurePlace = type === "ADVENTURE PLACE";
  const remainingTickets = availableTickets - bookedTickets;
  const isSoldOut = isTrip && availableTickets > 0 && remainingTickets <= 0;
  const fewSlotsRemaining = isTrip && remainingTickets > 0 && remainingTickets <= 10;
  const isUnavailable = isOutdated || isSoldOut;
  const isGuidedTour = isFlexibleDate && isTrip;

  const categoryMeta = useMemo(() => {
    if (!isAdventurePlace) return null;
    return (category && CATEGORY_META[category]) ?? DEFAULT_CATEGORY_META;
  }, [isAdventurePlace, category]);

  const displayType = useMemo(() => {
    if (isAdventurePlace) return categoryMeta!.label;
    if (isGuidedTour) return "Guided tour";
    if (isTrip) return "Trip";
    return "Attraction";
  }, [isAdventurePlace, isGuidedTour, isTrip, categoryMeta]);

  const badgeColor = categoryColor ?? categoryMeta?.color;

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
      TRIP: "trip",
      "ADVENTURE PLACE": "adventure",
      ATTRACTION: "attraction",
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    if (isSoldOut)
      return { text: "Sold out", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (isOutdated)
      return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    if (fewSlotsRemaining)
      return { text: `${remainingTickets} left`, color: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50" };
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

  const hoursText = useMemo(() => {
    if (openingHours || closingHours)
      return `${openingHours ?? "08:00"} – ${closingHours ?? "18:00"}`;
    return null;
  }, [openingHours, closingHours]);

  const distanceText = useMemo(() => {
    if (distance == null) return null;
    return distance < 1 ? `${Math.round(distance * 1000)} m away` : `${distance.toFixed(1)} km away`;
  }, [distance]);

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
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 active:scale-90 transition-all"
          >
            <Heart className={cn("h-4 w-4 transition-colors", isSaved ? "fill-red-500 text-red-500" : "text-slate-600 dark:text-slate-300")} />
          </button>
        )}

        {/* Desktop nav arrows */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-1.5 p-3 min-w-0">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-slate-50">
          {formattedName}
        </h3>

        {/* Location + rating, on one row so the card doesn't feel like a stack of separate facts */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 text-slate-500 dark:text-slate-400">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate">{locationString}</span>
          </div>
          {avgRating != null && avgRating > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {avgRating.toFixed(1)}
              </span>
              {reviewCount != null && reviewCount > 0 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">({reviewCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Secondary meta row: date / hours / distance — only render what applies */}
        {(isTrip && (date || isFlexibleDate)) || hoursText || distanceText ? (
          <div className="flex items-center gap-2.5 flex-wrap text-slate-500 dark:text-slate-400">
            {isTrip && (date || isFlexibleDate) && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Calendar className="h-3 w-3" />
                {isFlexibleDate ? "Flexible" : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            )}
            {hoursText && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Clock className="h-3 w-3" />
                {hoursText}
              </span>
            )}
            {distanceText && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Navigation className="h-3 w-3" />
                {distanceText}
              </span>
            )}
          </div>
        ) : null}

        {/* Price, anchored to the bottom of the card */}
        {!hidePrice && price != null && price > 0 && (
          <div className="pt-0.5">
            <PriceText price={price} isUnavailable={isUnavailable} isFlexibleDate={isFlexibleDate} isTrip={isTrip} />
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