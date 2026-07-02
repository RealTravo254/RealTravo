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
    <div className={cn("flex items-center gap-1 mt-0.5", isUnavailable && "opacity-50 line-through")}>
      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50 whitespace-nowrap">
        {formatPrice(price)}
      </span>
      <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
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
    // Proper word capitalization instead of lowercase
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
      return { text: "Sold out", color: "bg-destructive/20 text-destructive border-destructive/30" };
    if (isOutdated)
      return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    if (fewSlotsRemaining)
      return { text: `🔥 ${remainingTickets} left`, color: "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800/80" };
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
        "rounded-xl border border-border/80 shadow-sm",
        "hover:shadow-md hover:border-primary/40",
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
              "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow backdrop-blur-md text-white bg-slate-900/80 dark:bg-slate-900/90",
              !categoryColor && "bg-primary/95 text-primary-foreground",
            )}
            style={categoryColor ? { color: "#fff", backgroundColor: `${categoryColor}` } : undefined}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span
              className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-full border backdrop-blur-md shadow-sm",
                urgencyBadge.color,
              )}
            >
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Golden star rating badge — bottom-right over image */}
        {avgRating != null && avgRating > 0 && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow border border-slate-100 dark:border-slate-800 rounded-full px-2 py-0.5">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="text-xs font-black text-slate-900 dark:text-slate-50 leading-none">
              {avgRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Save / heart button — top-right */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
          >
            <Heart className={cn("h-4 w-4", isSaved ? "fill-red-500 text-red-500" : "text-slate-700 dark:text-slate-200")} />
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
            <span className="rounded-md border border-white px-3 py-1 text-xs font-black uppercase text-white tracking-wider bg-black/20">
              {isSoldOut ? "Sold Out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-1.5 p-3 min-w-0">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-950 dark:text-slate-50 tracking-tight">
          {formattedName}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
          <MapPin className="h-3 w-3 flex-shrink-0 text-slate-500" />
          <span className="text-xs font-semibold truncate capitalize">
            {locationString}
          </span>
        </div>

        {/* Price */}
        {!hidePrice && price != null && price > 0 && (
          <PriceText
            price={price}
            isUnavailable={isUnavailable}
            isFlexibleDate={isFlexibleDate}
            isTrip={isTrip}
          />
        )}

        {/* Date (trips only) */}
        {isTrip && (date || isFlexibleDate) && (
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Calendar className="h-3 w-3 text-slate-500" />
            <span className="text-xs font-semibold">
              {isFlexibleDate
                ? "Flexible Dates"
                : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        )}

        {/* Opening hours (adventure places) */}
        {hoursText && (
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Clock className="h-3 w-3 text-slate-500" />
            <span className="text-xs font-semibold">{hoursText}</span>
          </div>
        )}

        {/* Primary Rating Display below text elements */}
        {avgRating != null && avgRating > 0 && (
          <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{avgRating.toFixed(1)}</span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">({reviewCount} reviews)</span>
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