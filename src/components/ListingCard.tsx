import { useState, memo, useCallback, useMemo } from "react";
import { MapPin, Heart, Star, Calendar, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
} as const;

interface ListingCardProps {
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
}

const ListingCardComponent = ({
  id, type, name, imageUrl, location, country, price, date,
  isOutdated = false, onSave, isSaved = false, activities, 
  hidePrice = false, availableTickets = 0, bookedTickets = 0, 
  priority = false, compact = false, avgRating, distance, place
}: ListingCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();

  const { ref: imageContainerRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px', triggerOnce: true
  });

  const shouldLoadImage = priority || isIntersecting;
  
  // Type logic
  const isEventOrSport = useMemo(() => type === "EVENT" || type === "SPORT", [type]);
  const isTrip = useMemo(() => type === "TRIP", [type]);
  const tracksAvailability = useMemo(() => isEventOrSport || isTrip, [isEventOrSport, isTrip]);
  
  // Availability logic
  const remainingTickets = useMemo(() => availableTickets - bookedTickets, [availableTickets, bookedTickets]);
  const isSoldOut = useMemo(() => tracksAvailability && availableTickets > 0 && remainingTickets <= 0, [tracksAvailability, availableTickets, remainingTickets]);
  const fewSlotsRemaining = useMemo(() => tracksAvailability && remainingTickets > 0 && remainingTickets <= 10, [tracksAvailability, remainingTickets]);
  
  // Unified "Unavailable" state for visual overlays
  const isUnavailable = useMemo(() => isOutdated || isSoldOut, [isOutdated, isSoldOut]);
  
  const optimizedImageUrl = useMemo(() => optimizeSupabaseImage(imageUrl, { width: 400, height: 300, quality: 80 }), [imageUrl]);
  const displayType = useMemo(() => isEventOrSport ? "Event & Sports" : type.replace('_', ' '), [isEventOrSport, type]);
  const formattedDistance = useMemo(() => distance?.toFixed(2), [distance]);
  const locationString = useMemo(() => [place, location, country].filter(Boolean).join(', '), [place, location, country]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip", "EVENT": "event", "SPORT": "event", "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure", "ACCOMMODATION": "accommodation", "ATTRACTION": "attraction"
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const handleSaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSave?.(id, type);
  }, [onSave, id, type]);

  const handleImageLoad = useCallback(() => setImageLoaded(true), []);

  // Show distance for all types when location is available
  const showDistanceBadge = useMemo(() => distance !== undefined && distance > 0, [distance]);

  return (
    <Card 
      onClick={handleCardClick} 
      className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer border-slate-200 bg-slate-50 flex flex-col",
        "rounded-[24px]",
        compact ? "h-auto" : "h-full",
        isUnavailable && "opacity-90"
      )}
    >
      {/* Image Section */}
      <div ref={imageContainerRef} className="relative overflow-hidden m-2 rounded-[20px] bg-slate-100" style={{ paddingBottom: '70%' }}>
        {shouldLoadImage && (
          <img 
            src={optimizedImageUrl} 
            alt={name} 
            onLoad={handleImageLoad} 
            className={cn(
                "absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110", 
                imageLoaded ? "opacity-100" : "opacity-0",
                isUnavailable && "grayscale-[0.6]" 
            )} 
          />
        )}

        {/* SOLD OUT / NOT AVAILABLE OVERLAY */}
        {isUnavailable && (
          <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
            <Badge className="bg-white text-black font-black border-none px-4 py-1.5 text-[11px] uppercase shadow-2xl">
                {isSoldOut ? 'Sold Out' : 'Not Available'}
            </Badge>
          </div>
        )}
        
        {/* Category Badge */}
        <Badge 
          className="absolute top-3 left-3 z-10 px-1.5 py-0.5 border-none shadow-md text-[7.5px] font-black uppercase tracking-tight"
          style={{ background: isUnavailable ? '#64748b' : COLORS.TEAL, color: 'white' }}
        >
          {displayType}
        </Badge>

        {showDistanceBadge && (
          <Badge 
            className="absolute bottom-3 right-3 z-10 px-2 py-1 border-none shadow-lg text-[9px] font-black"
            style={{ background: COLORS.CORAL, color: 'white' }}
          >
            {formattedDistance} km
          </Badge>
        )}

        {onSave && (
          <button 
            onClick={handleSaveClick}
            aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
            className={cn(
                "absolute top-3 right-3 z-20 h-8 w-8 flex items-center justify-center rounded-full backdrop-blur-md transition-all", 
                isSaved ? "bg-red-500" : "bg-black/20 hover:bg-black/40"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", isSaved ? "text-white fill-white" : "text-white")} />
          </button>
        )}
      </div>
      
      {/* Content Section */}
      <div className="p-5 flex flex-col flex-1"> 
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-black text-sm md:text-lg leading-tight uppercase tracking-tighter line-clamp-2" 
              style={{ color: isUnavailable ? '#475569' : COLORS.TEAL }}>
            {name}
          </h3>
          {avgRating && (
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
              <Star className="h-3 w-3 fill-[#FF7F50] text-[#FF7F50]" />
              <span className="text-[11px] font-black" style={{ color: '#0d7377' }}>{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: isUnavailable ? '#94a3b8' : COLORS.CORAL }} />
            <p className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider line-clamp-1">
                {locationString}
            </p>
        </div>

        {activities && activities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {activities.slice(0, 3).map((act, i) => (
              <span key={i} className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter",
                isUnavailable ? "bg-slate-200 text-slate-500" : "bg-[#F0E68C]/30 text-[#5c5829]"
              )}>
                {typeof act === 'string' ? act : act.name}
              </span>
            ))}
          </div>
        )}
        
        {/* Bottom Metadata */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex flex-col">
                {!hidePrice && price !== undefined && (
                  <>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Starts at</span>
                    <span className={cn("text-base font-black", isUnavailable ? "text-slate-500 line-through" : "text-[#FF0000]")}>
                        KSh {price.toLocaleString()}
                    </span>
                  </>
                )}
            </div>

            <div className="flex flex-col items-end">
                {date && (
                  <div className="flex items-center gap-1 text-slate-600">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] font-black uppercase">
                          {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                  </div>
                )}
                
                <div className="mt-1">
                  {isOutdated ? (
                    <span className="text-[9px] font-black text-slate-600 uppercase">Event Passed</span>
                  ) : isSoldOut ? (
                    <span className="text-[9px] font-black text-red-600 uppercase">Sold Out</span>
                  ) : fewSlotsRemaining ? (
                    <span className="text-[9px] font-black text-red-500 uppercase animate-pulse flex items-center gap-1">
                        <Ticket className="h-2.5 w-2.5" />
                        Only {remainingTickets} left!
                    </span>
                  ) : (tracksAvailability && availableTickets > 0) && (
                    <span className="text-[9px] font-black text-teal-600/70 uppercase">
                        {remainingTickets} Slots available
                    </span>
                  )}
                </div>
            </div>
        </div>
      </div>
    </Card>
  );
};

export const ListingCard = memo(ListingCardComponent);