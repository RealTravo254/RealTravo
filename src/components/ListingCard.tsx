// src/components/ListingCard.tsx
import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from "react";
import { MapPin, Star, Calendar, ChevronLeft, ChevronRight, Clock, Heart, Navigation, BedDouble, ArrowRight } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { useItemRating } from "@/hooks/useItemRating";
import { truncateWords } from "@/lib/reviews";

// ── Design tokens ─────────────────────────────────────────────────────────
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const GOLD         = "#B98A2A";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const DANGER       = "#9C3B2B";
const SUCCESS      = "#2F6F4E";

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const DESCRIPTION_WORD_LIMIT = 100;

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
export const getHotelStartingPrice = (facilities?: any[] | null): number => {
  if (!Array.isArray(facilities)) return 0;
  const prices = facilities
    .map((f) => Number(f?.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : 0;
};

// ── Price label ─────────────────────────────────────────────────────────────
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

// NOTE: "accommodation" (Airbnb) intentionally has no label here.
const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  park: "Park",
  campsite: "Campsite",
  attraction: "Attraction",
};
const DEFAULT_CATEGORY_LABEL = "Campsite";

const PriceText = ({
  price, isUnavailable, isFlexibleDate, isTrip, date, isHotel = false,
}: {
  price: number; isUnavailable: boolean; isFlexibleDate: boolean; isTrip: boolean; date?: string; isHotel?: boolean;
}) => {
  const { formatPrice } = useCurrency();
  return (
    <div className={cn("flex items-baseline gap-1", isUnavailable && "opacity-50 line-through")} style={{ fontFamily: FONT_BODY }}>
      <span className="text-[11px] font-medium" style={{ color: INK_SOFT }}>From</span>
      <span className="text-[16px] font-bold tabular-nums whitespace-nowrap" style={{ color: CLAY }}>
        {formatPrice(price)}
      </span>
      <span className="text-[11px] font-medium" style={{ color: INK_SOFT }}>
        {getPriceLabel(isFlexibleDate, isTrip, date, isHotel)}
      </span>
    </div>
  );
};

// ── Hotel star row ───────────────────────────────────────────────────────────
const HotelStars = ({ count }: { count: number }) => (
  <div className="flex items-center gap-0.5" aria-label={`${count}-star hotel`}>
    {Array.from({ length: count }).map((_, i) => (
      <Star key={i} className="h-3 w-3" style={{ fill: GOLD, color: GOLD }} />
    ))}
  </div>
);

// ── Guest rating row ─────────────────────────────────────────────────────────
const RatingRow = ({ value, count }: { value: number; count: number }) => {
  if (!(value > 0)) {
    return (
      <div className="flex items-center gap-1.5" style={{ color: INK_SOFT }}>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-3 w-3" style={{ color: HAIRLINE }} />
          ))}
        </div>
        <span className="text-[11px] font-medium">No reviews yet</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className="h-3 w-3"
            style={{
              color: value >= i - 0.5 ? GOLD : HAIRLINE,
              fill: value >= i - 0.5 ? GOLD : "transparent",
            }}
          />
        ))}
      </div>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: INK }}>{value.toFixed(1)}</span>
      {count > 0 && (
        <span className="text-[11px]" style={{ color: INK_SOFT }}>
          ({count})
        </span>
      )}
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
  division?: string | null;
  showFlexibleDate?: boolean;
  description?: string;
  categoryColor?: string;
  galleryImages?: string[];
  images?: string[];
  openingHours?: string;
  closingHours?: string;
  workingDays?: string[];
  starRating?: number | null;
  facilities?: any[] | null;
}

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ListingCardComponent = ({
  id, type, category, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, hideSave = false,
  availableTickets = 0, bookedTickets = 0,
  priority = false, avgRating, reviewCount, place, division,
  isFlexibleDate = false, hidePrice = false, categoryColor,
  openingHours, closingHours, distance, workingDays,
  starRating, facilities, description,
}: ListingCardProps) => {
  useInjectFonts();

  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(2);
  const [imageLoadStates, setImageLoadStates] = useState<Record<number, boolean>>({});
  const touchStartX = useRef(0);
  const { ref: cardRef, isIntersecting } = useIntersectionObserver({ rootMargin: "300px", triggerOnce: true });
  const shouldLoad = priority || isIntersecting;

  const hasPropRating = avgRating != null && avgRating > 0;
  const fetched = useItemRating(id, shouldLoad && !hasPropRating);
  const ratingValue = hasPropRating ? (avgRating as number) : fetched.avg;
  const ratingCount = hasPropRating ? (reviewCount ?? 0) : fetched.count;

  const allSlideImages = useMemo(() => [imageUrl].filter(Boolean), [imageUrl]);
  const isTrip = type === "TRIP";
  const isAdventurePlace = type === "ADVENTURE PLACE";
  const isHotel = isAdventurePlace && category === "hotel";
  const remainingTickets = availableTickets - bookedTickets;
  const isGuidedTour = isFlexibleDate && isTrip;
  const isSoldOut = isTrip && !isGuidedTour && availableTickets > 0 && remainingTickets <= 0;
  const isUnavailable = isOutdated || isSoldOut;

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

  const badgeColor = categoryColor;

  const formattedName = useMemo(
    () => name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    [name],
  );
  const locationString = useMemo(() => {
    const area = (division && division.trim()) || place;
    const raw = [area, location].filter(Boolean).join(", ");
    return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }, [division, place, location]);

  const aboutText = useMemo(() => {
    const clean = (description || "").replace(/\s+/g, " ").trim();
    return clean ? truncateWords(clean, DESCRIPTION_WORD_LIMIT) : "";
  }, [description]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      TRIP: "trip",
      "ADVENTURE PLACE": "adventure",
      ATTRACTION: "attraction",
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

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

  const isCampsite = category === "campsite";

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
      return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
    }
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }, [isAdventurePlace, isCampsite, openingHours, closingHours, workingDays]);

  const showPrice = !hidePrice && displayPrice > 0;

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
      className={cn(
        // Rectangular (landscape) card: image on the left, details on the right
        "group relative flex flex-row overflow-hidden cursor-pointer bg-white transition-all duration-300",
        "rounded-2xl shadow-sm",
        "hover:shadow-xl hover:-translate-y-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "w-full h-full min-h-[200px]",
        isUnavailable && "opacity-80",
      )}
      style={{
        border: `1px solid ${HAIRLINE}`,
        fontFamily: FONT_BODY,
        // @ts-ignore custom property consumed by the focus-visible ring utility above
        "--tw-ring-color": FOREST,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${CLAY}60`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIRLINE)}
    >
      {/* ── Image (left) ── */}
      <div
        className="relative w-[40%] sm:w-[38%] shrink-0 self-stretch overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute inset-0 flex transition-transform duration-300 ease-out"
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
                      ? optimizeSupabaseImage(img, { width: 500, height: 500, quality: 80 })
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
                    "group-hover:scale-[1.05]",
                    imageLoadStates[idx] ? "opacity-100" : "opacity-0",
                    isUnavailable && "grayscale-[0.5]",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Scrims keep badges legible on bright photos */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{ background: "linear-gradient(to bottom, rgba(14,23,18,0.45), transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14" style={{ background: "linear-gradient(to top, rgba(14,23,18,0.45), transparent)" }} />

        {/* Category badge — top-left */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-sm text-white backdrop-blur-sm"
            style={{ backgroundColor: badgeColor ? `${badgeColor}E6` : `${FOREST_DEEP}E6`, fontFamily: FONT_BODY }}
          >
            {isHotel && <BedDouble className="h-3 w-3" />}
            {displayType}
          </span>
        </div>

        {/* Save / heart — top-right */}
        {!hideSave && onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(id, type); }}
            aria-label={isSaved ? "Remove from saved" : "Save"}
            aria-pressed={isSaved}
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-white/95 shadow flex items-center justify-center hover:bg-white active:scale-90 transition-all"
          >
            <Heart className="h-4 w-4 transition-colors" style={isSaved ? { fill: CLAY, color: CLAY } : { color: INK_SOFT }} />
          </button>
        )}

        {allSlideImages.length > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                onClick={(e) => goToSlide(currentSlide - 1, e)}
                aria-label="Previous photo"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4" style={{ color: INK }} />
              </button>
            )}
            {currentSlide < visibleDots - 1 && (
              <button
                onClick={(e) => goToSlide(currentSlide + 1, e)}
                aria-label="Next photo"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-4 w-4" style={{ color: INK }} />
              </button>
            )}
          </>
        )}

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

        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]" style={{ background: "rgba(14,23,18,0.5)" }}>
            <span className="rounded-full border border-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              {isSoldOut ? "Sold out" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* ── Details (right) ── */}
      <div className="flex flex-col gap-1.5 p-3 sm:p-4 min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[16px] sm:text-[18px] font-bold leading-snug" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
          {formattedName}
        </h3>

        <div className="flex items-center gap-1 min-w-0" style={{ color: INK_SOFT }}>
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: CLAY }} />
          <span className="text-[12px] sm:text-[13px] font-medium truncate">{locationString}</span>
        </div>

        {isHotel && stars > 0 && <HotelStars count={stars} />}

        <RatingRow value={ratingValue} count={ratingCount} />

        {aboutText && (
          <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: INK_SOFT }}>
            {aboutText}
          </p>
        )}

        {/* Date / distance / open-now chips */}
        {((isTrip && (date || isFlexibleDate)) || distanceText || isOpenNow !== null) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {isTrip && (date || isFlexibleDate) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg" style={{ background: FOREST_SOFT, color: FOREST }}>
                <Calendar className="h-3 w-3" />
                {isFlexibleDate ? "Flexible" : new Date(date!).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            )}
            {distanceText && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg" style={{ background: FOREST_SOFT, color: FOREST }}>
                <Navigation className="h-3 w-3" />
                {distanceText}
              </span>
            )}
            {isOpenNow !== null && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg text-white"
                style={{ background: isOpenNow ? SUCCESS : DANGER }}
              >
                {isOpenNow ? "Open now" : "Closed"}
              </span>
            )}
          </div>
        )}

        {/* Hotel check-in / check-out */}
        {isHotel && (openingHours || closingHours) && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: INK_SOFT }}>
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {openingHours && <>In {openingHours}</>}
              {openingHours && closingHours && <span className="mx-1">·</span>}
              {closingHours && <>Out {closingHours}</>}
            </span>
          </div>
        )}

        {/* Working hours + day pills (pills hidden on very small screens) */}
        {isAdventurePlace && !isHotel && hoursText && (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: INK_SOFT }}>
              <Clock className="h-3 w-3" />
              {hoursText}
            </span>
            {workingDays && workingDays.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 flex-wrap">
                {DAY_ORDER.map((day) => {
                  const isOpenDay = workingDays.includes(day);
                  return (
                    <span
                      key={day}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
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

        {/* Footer: price + view link, pinned to the bottom */}
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {showPrice ? (
            <PriceText price={displayPrice} isUnavailable={isUnavailable} isFlexibleDate={isFlexibleDate} isTrip={isTrip} date={date} isHotel={isHotel} />
          ) : (
            <span />
          )}
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold transition-all group-hover:gap-1.5 whitespace-nowrap"
            style={{ color: FOREST }}
          >
            View details <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
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