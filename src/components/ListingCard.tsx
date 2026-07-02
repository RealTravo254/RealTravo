import React, { useState, memo, useCallback, useMemo, useRef } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const CATEGORY_LABELS: Record<string, string> = {
  hotel:         "Hotel",
  park:          "Park",
  campsite:      "Campsite",
  attraction:    "Attraction",
  accommodation: "Accommodation",
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
  openingHours, closingHours,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
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

  const formattedName = useMemo(() => name.replace(/\b\w/g, (c) => c.toUpperCase()), [name]);
  const locationString = useMemo(() => [place, location].filter(Boolean).join(", "), [place, location]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = { TRIP: "trip", "ADVENTURE PLACE": "adventure", ATTRACTION: "attraction" };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    if (isSoldOut) return { text: "Sold out", bg: "#fee2e2", color: "#991b1b" };
    if (isOutdated) return { text: "Passed", bg: "#f1f5f9", color: "#334155" };
    if (fewSlotsRemaining) return { text: `🔥 ${remainingTickets} left`, bg: "#ffedd5", color: "#9a3412" };
    return null;
  }, [isSoldOut, isOutdated, fewSlotsRemaining, remainingTickets]);

  const goToSlide = useCallback((index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const maxIndex = Math.min(allSlideImages.length - 1, loadedSlides - 1);
    const newIndex = Math.max(0, Math.min(index, maxIndex));
    setCurrentSlide(newIndex);
    if (newIndex >= loadedSlides - 1 && loadedSlides < allSlideImages.length) {
      setLoadedSlides((prev) => Math.min(prev + 2, allSlideImages.length));
    }
  }, [allSlideImages.length, loadedSlides]);

  // Formats start/end hours and appends calculated total duration string
  const inlineHoursAndDuration = useMemo(() => {
    const start = openingHours ?? "09:00";
    const end = closingHours ?? "16:00";

    try {
      const [startH, startM] = start.split(":").map(Number);
      const [endH, endM] = end.split(":").map(Number);
      
      let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (durationMinutes < 0) durationMinutes += 24 * 60;

      const hours = Math.floor(durationMinutes / 60);
      const durationText = hours > 0 ? ` (${hours} hrs)` : "";

      // Helper function to turn 24h into AM/PM
      const formatAMPM = (h: number, m: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = m.toString().padStart(2, '0');
        return `${displayH}:${displayM} ${ampm}`;
      };

      const timeRangeString = `${formatAMPM(startH, startM)} - ${formatAMPM(endH, endM)}`;
      return `${timeRangeString}${durationText}`;
    } catch (err) {
      return `${start} - ${end}`;
    }
  }, [openingHours, closingHours]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className="group relative flex flex-col overflow-hidden cursor-pointer w-full transition-all duration-300 rounded-xl border shadow-sm hover:shadow-md"
      style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
    >
      {/* ── IMAGE SECTION ── */}
      <div
        className="relative w-full overflow-hidden aspect-[4/3]"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) diff > 0 ? goToSlide(currentSlide + 1) : goToSlide(currentSlide - 1);
        }}
      >
        <div
          ref={slideContainerRef}
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {allSlideImages.slice(0, loadedSlides).map((img, idx) => (
            <div key={idx} className="min-w-full h-full flex-shrink-0 relative">
              {!imageLoadStates[idx] && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
              {shouldLoad && (
                <img
                  src={img.includes("supabase.co/storage") ? optimizeSupabaseImage(img, { width: 500, height: 375, quality: 80 }) : img}
                  alt={`${name} - ${idx + 1}`}
                  onLoad={() => setImageLoadStates((prev) => ({ ...prev, [idx]: true }))}
                  className={cn("w-full h-full object-cover transition-opacity duration-300", imageLoadStates[idx] ? "opacity-100" : "opacity-0", isUnavailable && "grayscale-[0.5]")}
                />
              )}
            </div>
          ))}
        </div>

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow"
            style={{ color: "#ffffff", backgroundColor: categoryColor || "#0f172a" }}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border"
              style={{ backgroundColor: urgencyBadge.bg, color: urgencyBadge.color, borderColor: urgencyBadge.color + "40" }}
            >
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Save/Heart Button */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full shadow flex items-center justify-center transition-colors border"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", borderColor: "#e2e8f0" }}
          >
            <Heart className="h-4 w-4" style={{ fill: isSaved ? "#ef4444" : "none", stroke: isSaved ? "#ef4444" : "#0f172a" }} />
          </button>
        )}

        {/* Slides Navigation Controls */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button onClick={(e) => goToSlide(currentSlide - 1, e)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronLeft className="h-4 w-4" style={{ stroke: "#0f172a" }} />
              </button>
            )}
            {currentSlide < Math.min(loadedSlides, allSlideImages.length) - 1 && (
              <button onClick={(e) => goToSlide(currentSlide + 1, e)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-4 w-4" style={{ stroke: "#0f172a" }} />
              </button>
            )}
          </>
        )}

        {/* Image Status Overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
            <span className="border border-white px-3 py-1 text-xs font-black uppercase text-white tracking-wider bg-black/20 rounded">
              {isSoldOut ? "Sold Out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── TEXT CONTENT AREA ── */}
      <div className="flex flex-col gap-2 p-4 min-w-0" style={{ backgroundColor: "#ffffff" }}>
        
        {/* Title Block */}
        <h3 
          className="line-clamp-2 text-sm font-normal leading-snug tracking-tight"
          style={{ color: "#090d16", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {formattedName}
        </h3>

        {/* Location Block - Kept bold and dark color (#0f172a) */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 flex-shrink-0" style={{ stroke: "#475569" }} />
          <span className="text-xs font-bold truncate capitalize" style={{ color: "#0f172a" }}>
            {locationString}
          </span>
        </div>

        {/* Price Block */}
        {!hidePrice && price != null && price > 0 && (
          <div className={cn("flex items-baseline gap-1 mt-0.5", isUnavailable && "opacity-40 line-through")}>
            <span className="text-xs font-normal mr-0.5" style={{ color: "#475569" }}>
              From
            </span>
            <span className="text-base font-black whitespace-nowrap" style={{ color: "#020617" }}>
              {formatPrice(price)}
            </span>
          </div>
        )}

        {/* Date / Trip Details Block - Displays dates OR explicit starting hours, ending hours, and duration */}
        {isTrip && (date || isFlexibleDate) && (
          <div className="flex flex-col gap-1.5 mt-0.5">
            {/* Base Date Line */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 flex-shrink-0" style={{ stroke: "#64748b" }} />
              <span className="text-xs font-normal" style={{ color: "#64748b" }}>
                {isFlexibleDate ? "Flexible Dates" : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
            
            {/* Hours, End Hours, and Total Duration Line */}
            <div className="text-xs font-normal pl-6" style={{ color: "#64748b" }}>
              {inlineHoursAndDuration}
            </div>
          </div>
        )}

        {/* Separator Line and Rating/Review Block */}
        {avgRating != null && avgRating > 0 && (
          <div className="flex items-center gap-1 pt-2 mt-1 border-t" style={{ borderColor: "#f1f5f9" }}>
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" style={{ fill: "#f59e0b", stroke: "#f59e0b" }} />
            <span className="text-xs font-black" style={{ color: "#0f172a" }}>
              {avgRating.toFixed(1)}
            </span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[11px] font-bold" style={{ color: "#475569" }}>
                ({reviewCount} reviews)
              </span>
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