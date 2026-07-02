import React, { useState, memo, useCallback, useMemo, useRef } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart, Timer } from "lucide-react";
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

// ── Category badge labels ─────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  hotel:         "Hotel",
  park:          "Park",
  campsite:      "Campsite",
  attraction:    "Attraction",
  accommodation: "Accommodation",
};

// ── Format duration from minutes ──────────────────────────────────────────────
const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
    <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")}>
      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50 whitespace-nowrap leading-none">
        {formatPrice(price)}
      </span>
      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
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
  /** Duration in minutes — shown as "2h", "1h 30m", "45m" etc. */
  durationMinutes?: number;
}

const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, activities, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, durationMinutes,
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
    if (isSoldOut)
      return { text: "Sold out", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (isOutdated)
      return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    if (fewSlotsRemaining)
      return { text: `🔥 ${remainingTickets} left`, color: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50" };
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

  const durationText = useMemo(
    () => (durationMinutes ? formatDuration(durationMinutes) : null),
    [durationMinutes],
  );

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl border border-border shadow-sm",
        "hover:shadow-md hover:border-primary/20",
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
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm backdrop-blur-sm",
              !categoryColor && "text-primary-foreground bg-primary/90",
            )}
            style={categoryColor ? { color: "#fff", backgroundColor: `${categoryColor}dd` } : undefined}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span
              className={cn(
                "text-[8px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm",
                urgencyBadge.color,
              )}
            >
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Duration badge — bottom-left over image */}
        {durationText && (
          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Timer className="h-2.5 w-2.5 text-white" />
            <span className="text-[10px] font-bold text-white leading-none">{durationText}</span>
          </div>
        )}

        {/* Golden star rating badge — bottom-right over image */}
        {avgRating != null && avgRating > 0 && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-sm rounded-full px-1.5 py-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-none">
              {avgRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Save / heart button — top-right */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <Heart className={cn("h-3.5 w-3.5", isSaved ? "fill-red-500 text-red-500" : "text-slate-600 dark:text-slate-300")} />
          </button>
        )}

        {/* Desktop nav arrows */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/80 dark:bg-slate-900/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-foreground" />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/80 dark:bg-slate-900/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-3.5 w-3.5 text-foreground" />
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
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-md border border-white/60 px-3 py-0.5 text-[10px] font-black uppercase text-white">
              {isSoldOut ? "Sold Out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-col gap-1.5 p-3 min-w-0">

        {/* Title — bolder, slightly larger */}
        <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-slate-900 dark:text-slate-50 tracking-tight">
          {formattedName}
        </h3>

        {/* Location — medium weight, clearly visible */}
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <MapPin className="h-3 w-3 flex-shrink-0 text-primary" />
          <span className="text-[11px] font-semibold truncate capitalize">
            {locationString.toLowerCase()}
          </span>
        </div>

        {/* Price — prominent */}
        {!hidePrice && price != null && price > 0 && (
          <PriceText
            price={price}
            isUnavailable={isUnavailable}
            isFlexibleDate={isFlexibleDate}
            isTrip={isTrip}
          />
        )}

        {/* Row: date + duration (trips only) */}
        {isTrip && (date || isFlexibleDate || durationText) && (
          <div className="flex items-center gap-2 flex-wrap">
            {(date || isFlexibleDate) && (
              <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                <Calendar className="h-3 w-3" />
                <span className="text-[10px] font-semibold">
                  {isFlexibleDate
                    ? "Flexible"
                    : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
              </div>
            )}
            {durationText && (
              <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                <Timer className="h-3 w-3" />
                <span className="text-[10px] font-semibold">{durationText}</span>
              </div>
            )}
          </div>
        )}

        {/* Duration standalone — adventure places / attractions (if no date row) */}
        {!isTrip && durationText && (
          <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
            <Timer className="h-3 w-3" />
            <span className="text-[10px] font-semibold">{durationText}</span>
          </div>
        )}

        {/* Opening hours (adventure places) */}
        {hoursText && (
          <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-semibold">{hoursText}</span>
          </div>
        )}

        {/* Star rating + review count */}
        {avgRating != null && avgRating > 0 && (
          <div className="flex items-center gap-0.5 pt-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{avgRating.toFixed(1)}</span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">({reviewCount})</span>
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