import React, { useState, memo, useCallback, useMemo, useRef } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ── Price label ───────────────────────────────────────────────────────────────
const getPriceLabel = (isFlexibleDate: boolean, isTrip: boolean) => {
  if (isFlexibleDate && isTrip) return "/group";
  return "/person";
};

// ── Category badge labels for adventure_places ────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  hotel:         "Hotel",
  park:          "Park",
  campsite:      "Campsite",
  attraction:    "Attraction",
  accommodation: "Accommodation",
};

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
    <div className={cn("flex items-baseline gap-1 mt-0.5", isUnavailable && "opacity-40 line-through")}>
      {/* FIXED: Using text-slate-950 for deep black text on white backgrounds */}
      <span className="text-sm font-black text-slate-950 dark:text-slate-50 whitespace-nowrap">
        {formatPrice(price)}
      </span>
      <span className="text-[11px] text-slate-900 dark:text-slate-200 font-bold">
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
  isOutdated = false, activities, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours,
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

  const displayType = useMemo(() => {
    if (isAdventurePlace) return (category && CATEGORY_LABELS[category]) ?? "Campsite";
    if (isGuidedTour) return "Guided Tour";
    if (isTrip) return "Trip";
    return "Attraction";
  }, [isAdventurePlace, isGuidedTour, isTrip, category]);

  const formattedName = useMemo(
    () => name.replace(/\b\w/g, (c) => c.toUpperCase()),
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
    if (isSoldOut)
      return { text: "Sold out", color: "bg-destructive/20 text-destructive border-destructive/40 font-bold" };
    if (isOutdated)
      return { text: "Passed", color: "bg-muted text-slate-900 border-slate-300 font-bold" };
    if (fewSlotsRemaining)
      return { text: `🔥 ${remainingTickets} left`, color: "bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200 border-orange-400 font-extrabold" };
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
      return `${openingHours ?? "08:00"} - ${closingHours ?? "18:00"}`;
    return null;
  }, [openingHours, closingHours]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm",
        "hover:shadow-md hover:border-primary/45",
        "w-full",
        isUnavailable && "opacity-85",
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
                  alt={`${name} - ${idx + 1}`}
                  onLoad={() => setImageLoadStates((prev) => ({ ...prev, [idx]: true }))}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    if (t.src !== img) t.src = img;
                  }}
                  className={cn(
                    "w-full h-full object-cover",
                    imageLoadStates[idx] ? "opacity-100" : "opacity-0",
                    isUnavailable && "grayscale-[0.5]",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Category badge — top-left */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow backdrop-blur-md text-white bg-slate-950/90 dark:bg-slate-900/95",
              !categoryColor && "bg-primary text-primary-foreground",
            )}
            style={categoryColor ? { color: "#fff", backgroundColor: `${categoryColor}` } : undefined}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span
              className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-full border backdrop-blur-md shadow-sm",
                urgencyBadge.color,
              )}
            >
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Save / heart button — top-right */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
          >
            <Heart className={cn("h-4 w-4", isSaved ? "fill-red-500 text-red-500" : "text-slate-950 dark:text-slate-100")} />
          </button>
        )}

        {/* Desktop nav arrows */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4 text-foreground font-bold" />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/90 dark:bg-slate-900/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-4 w-4 text-foreground font-bold" />
              </button>
            )}
          </>
        )}

        {/* Dot indicators */}
        {allSlideImages.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
            {Array.from({ length: visibleDots }).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => goToSlide(idx, e)}
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
            <span className="rounded-md border border-white px-3 py-1 text-xs font-black uppercase text-white tracking-wider bg-black/30">
              {isSoldOut ? "Sold Out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-2 p-3.5 min-w-0">
        {/* FIXED: Title changed to text-slate-950 for deep contrast */}
        <h3 className="line-clamp-2 text-sm font-black leading-snug text-slate-950 dark:text-slate-50 tracking-tight">
          {formattedName}
        </h3>

        {/* FIXED: Location element text changed to bold slate-900 */}
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
          <span className="text-xs font-bold truncate capitalize">
            {locationString}
          </span>
        </div>

        {/* Price Section */}
        {!hidePrice && price != null && price > 0 && (
          <PriceText
            price={price}
            isUnavailable={isUnavailable}
            isFlexibleDate={isFlexibleDate}
            isTrip={isTrip}
          />
        )}

        {/* FIXED: Clearer styling for Dates */}
        {isTrip && (date || isFlexibleDate) && (
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
            <Calendar className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
            <span className="text-xs font-bold">
              {isFlexibleDate
                ? "Flexible Dates"
                : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        )}

        {/* FIXED: Clearer styling for Hours */}
        {hoursText && (
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
            <Clock className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
            <span className="text-xs font-bold">{hoursText}</span>
          </div>
        )}

        {/* FIXED: Separation border and solid bold styling for rating review block */}
        {avgRating != null && avgRating > 0 && (
          <div className="flex items-center gap-1 pt-2 border-t border-slate-200 dark:border-slate-800 mt-1">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span className="text-xs font-black text-slate-950 dark:text-slate-50">{avgRating.toFixed(1)}</span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">({reviewCount} reviews)</span>
            )}
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