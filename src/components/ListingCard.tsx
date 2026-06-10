import React, { useState, memo, useCallback, useMemo, useEffect, useRef } from "react";
import { MapPin, Star, Calendar, Ticket, ChevronLeft, ChevronRight, Clock, Heart } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ── Price label logic ─────────────────────────────────────────────────────────
const getPriceLabel = (type: string, isFlexibleDate: boolean, isTrip: boolean) => {
  if (isFlexibleDate && isTrip) return "/group";
  if (["HOTEL", "ACCOMMODATION"].includes(type)) return "/night";
  return "/person";
};

const PriceText = ({
  price,
  isUnavailable,
  type,
  isFlexibleDate,
  isTrip,
}: {
  price: number;
  isUnavailable: boolean;
  type: string;
  isFlexibleDate: boolean;
  isTrip: boolean;
}) => {
  const { formatPrice } = useCurrency();
  const label = getPriceLabel(type, isFlexibleDate, isTrip);

  return (
    <div className={cn("flex items-center gap-1", isUnavailable && "opacity-50 line-through")}>
      <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{formatPrice(price)}</span>
      <span className="text-[8px] text-slate-500 font-medium">{label}</span>
    </div>
  );
};

export interface ListingCardProps {
  id: string;
  type: 'TRIP' | 'EVENT' | 'SPORT' | 'HOTEL' | 'ADVENTURE PLACE' | 'ACCOMMODATION' | 'ATTRACTION';
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
  /**
   * approval_status — used to gate visibility of ADVENTURE PLACE listings.
   * If the type is "ADVENTURE PLACE" and this is not "approved", the card
   * returns null and is not rendered. Pass this from your data queries.
   */
  approvalStatus?: string;
}

const ListingCardComponent = ({
  id, type, name, imageUrl, location, price, date,
  isOutdated = false, activities, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, compact = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, description, categoryColor,
  galleryImages, images: extraImages, country,
  openingHours, closingHours,
  approvalStatus,
}: ListingCardProps) => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(2);
  const [imageLoadStates, setImageLoadStates] = useState<Record<number, boolean>>({});
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const { ref: cardRef, isIntersecting } = useIntersectionObserver({ rootMargin: '300px', triggerOnce: true });
  const shouldLoad = priority || isIntersecting;

  // ── GATE: Adventure places that are not approved are invisible to public ──
  const isAdventurePlace = type === "ADVENTURE PLACE";
  if (isAdventurePlace && approvalStatus !== "approved") {
    return null;
  }

  const allSlideImages = useMemo(() => {
    const imgs = [imageUrl];
    if (galleryImages?.length) imgs.push(...galleryImages);
    if (extraImages?.length) imgs.push(...extraImages);
    return imgs.filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
  }, [imageUrl, galleryImages, extraImages]);

  const isEventOrSport = type === "EVENT" || type === "SPORT";
  const isTrip = type === "TRIP";
  const tracksAvailability = isEventOrSport || isTrip;

  const remainingTickets = availableTickets - bookedTickets;
  const isSoldOut = tracksAvailability && availableTickets > 0 && remainingTickets <= 0;
  const fewSlotsRemaining = tracksAvailability && remainingTickets > 0 && remainingTickets <= 10;
  const isUnavailable = isOutdated || isSoldOut;

  const isGuidedTour = isFlexibleDate && isTrip;

  const displayType = useMemo(() => {
    if (isGuidedTour) return "Guided Tour";
    if (isEventOrSport) return "Event";
    if (type === "ADVENTURE PLACE") return "Adventure";
    if (type === "HOTEL") return "Hotel";
    if (type === "TRIP") return "Trip";
    return type.replace('_', ' ');
  }, [isEventOrSport, type, isGuidedTour]);

  const formattedName = useMemo(() => name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), [name]);
  const locationString = useMemo(() => [place, location].filter(Boolean).join(', '), [place, location]);

  const subtitle = useMemo(() => {
    if (activities && activities.length > 0) {
      const names = activities.slice(0, 2).map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean);
      return names.join(' • ');
    }
    return null;
  }, [activities]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip", "EVENT": "event", "SPORT": "event", "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure", "ACCOMMODATION": "accommodation", "ATTRACTION": "attraction"
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const urgencyBadge = useMemo(() => {
    if (isSoldOut) return { text: "Sold out", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (isOutdated) return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    if (fewSlotsRemaining) return { text: `🔥 ${remainingTickets} left`, color: "bg-orange-50 text-orange-700 border-orange-200" };
    return null;
  }, [isSoldOut, isOutdated, fewSlotsRemaining, remainingTickets]);

  const goToSlide = useCallback((index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const maxIndex = Math.min(allSlideImages.length - 1, loadedSlides - 1);
    const newIndex = Math.max(0, Math.min(index, maxIndex));
    setCurrentSlide(newIndex);
    if (newIndex >= loadedSlides - 1 && loadedSlides < allSlideImages.length) {
      setLoadedSlides(prev => Math.min(prev + 2, allSlideImages.length));
    }
  }, [allSlideImages.length, loadedSlides]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goToSlide(currentSlide + 1);
      else goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  const visibleDots = Math.min(loadedSlides, allSlideImages.length);

  const hoursText = useMemo(() => {
    if (openingHours || closingHours) {
      return `${openingHours || "08:00"} - ${closingHours || "18:00"}`;
    }
    return null;
  }, [openingHours, closingHours]);

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl border border-border shadow-sm",
        "hover:shadow-md hover:border-primary/20",
        "w-full",
        isUnavailable && "opacity-80"
      )}
    >
      {/* Image Slideshow */}
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
                  src={img.includes('supabase.co/storage') ? optimizeSupabaseImage(img, { width: 500, height: 375, quality: 80 }) : img}
                  alt={`${name} - ${idx + 1}`}
                  onLoad={() => setImageLoadStates(prev => ({ ...prev, [idx]: true }))}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== img) {
                      target.src = img;
                    }
                  }}
                  className={cn(
                    "w-full h-full object-cover",
                    imageLoadStates[idx] ? "opacity-100" : "opacity-0",
                    isUnavailable && "grayscale-[0.5]"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Category badge */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm backdrop-blur-sm",
              !categoryColor && "text-primary-foreground bg-primary/90"
            )}
            style={categoryColor ? { color: '#fff', backgroundColor: `${categoryColor}dd` } : undefined}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm", urgencyBadge.color)}>
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Save button */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            className="absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-white/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-white transition-colors"
          >
            <Heart className={cn("h-3.5 w-3.5", isSaved ? "fill-red-500 text-red-500" : "text-slate-600")} />
          </button>
        )}

        {/* Navigation arrows */}
        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-foreground" />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-white/80 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                  idx === currentSlide
                    ? "w-2 h-2 bg-white shadow-md"
                    : "w-1.5 h-1.5 bg-white/60"
                )}
              />
            ))}
            {loadedSlides < allSlideImages.length && (
              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            )}
          </div>
        )}

        {/* Sold out overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rounded-md border border-white/60 px-3 py-0.5 text-[10px] font-black uppercase text-white">
              {isSoldOut ? 'Sold Out' : 'Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-2.5 min-w-0">
        <h3 className="line-clamp-2 text-xs font-bold leading-snug text-slate-900">
          {formattedName}
        </h3>

        <div className="flex items-center gap-1 text-slate-500">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[10px] font-medium truncate capitalize">{locationString.toLowerCase()}</span>
        </div>

        {!hidePrice && price != null && price > 0 && (
          <PriceText
            price={price}
            isUnavailable={isUnavailable}
            type={type}
            isFlexibleDate={isFlexibleDate}
            isTrip={isTrip}
          />
        )}

        {(date || isFlexibleDate) && (
          <div className="flex items-center gap-0.5 text-slate-500">
            <Calendar className="h-2.5 w-2.5" />
            <span className="text-[9px] font-medium">
              {isFlexibleDate ? 'Flexible' : new Date(date!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}

        {hoursText && (
          <div className="flex items-center gap-0.5 text-slate-500">
            <Clock className="h-2.5 w-2.5" />
            <span className="text-[9px] font-medium">{hoursText}</span>
          </div>
        )}

        {avgRating != null && avgRating > 0 && (
          <div className="flex items-center gap-0.5 pt-0.5">
            <Star className="h-2.5 w-2.5 fill-slate-800 text-slate-800" />
            <span className="text-[10px] font-bold text-slate-800">{avgRating.toFixed(1)}</span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[8px] text-slate-500">({reviewCount})</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export const ListingCard = memo(React.forwardRef<HTMLDivElement, ListingCardProps>(
  (props, ref) => <ListingCardComponent {...props} />
));
ListingCard.displayName = "ListingCard";