import { useState, memo, useCallback, useMemo, useEffect } from "react";
import { MapPin, Heart, Star, Calendar, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  showFlexibleDate?: boolean;
}

const ListingCardComponent = ({
  id, type, name, imageUrl, location, country, price, date,
  isOutdated = false, onSave, isSaved = false, activities, 
  hidePrice = false, availableTickets = 0, bookedTickets = 0, 
  priority = false, compact = false, avgRating, distance, place,
  isFlexibleDate = false
}: ListingCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(isSaved);
  const navigate = useNavigate();

  useEffect(() => {
    setIsSavedLocal(isSaved);
  }, [isSaved]);

  const { ref: imageContainerRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '300px',
    triggerOnce: true
  });

  const shouldLoadImage = priority || isIntersecting;
  const isEventOrSport = useMemo(() => type === "EVENT" || type === "SPORT", [type]);
  const isTrip = useMemo(() => type === "TRIP", [type]);
  const tracksAvailability = useMemo(() => isEventOrSport || isTrip, [isEventOrSport, isTrip]);
  
  const remainingTickets = useMemo(() => availableTickets - bookedTickets, [availableTickets, bookedTickets]);
  const isSoldOut = useMemo(() => tracksAvailability && availableTickets > 0 && remainingTickets <= 0, [tracksAvailability, availableTickets, remainingTickets]);
  const fewSlotsRemaining = useMemo(() => tracksAvailability && remainingTickets > 0 && remainingTickets <= 10, [tracksAvailability, remainingTickets]);
  const isUnavailable = useMemo(() => isOutdated || isSoldOut, [isOutdated, isSoldOut]);

  const optimizedImageUrl = useMemo(() => optimizeSupabaseImage(imageUrl, { width: 500, height: 350, quality: 80 }), [imageUrl]);
  const thumbnailUrl = useMemo(() => optimizeSupabaseImage(imageUrl, { width: 32, height: 24, quality: 30 }), [imageUrl]);
  const displayType = useMemo(() => isEventOrSport ? "Event & Sports" : type.replace('_', ' '), [isEventOrSport, type]);
  const formattedDistance = useMemo(() => distance?.toFixed(2), [distance]);
  
  // Capitalize first letter of each word for name
  const formattedName = useMemo(() => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [name]);
  
  const locationString = useMemo(() => [place, location].filter(Boolean).join(', '), [place, location]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip", "EVENT": "event", "SPORT": "event", "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure", "ACCOMMODATION": "accommodation", "ATTRACTION": "attraction"
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const handleSaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSavedLocal(!isSavedLocal);
    onSave?.(id, type);
  }, [onSave, id, type, isSavedLocal]);

  const handleImageLoad = useCallback(() => setImageLoaded(true), []);
  const handleImageError = useCallback(() => setImageError(true), []);

  return (
    <Card 
      onClick={handleCardClick} 
      className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer border-slate-200 flex flex-col",
        "rounded-sm bg-white w-full max-w-full", // Removed min-w to prevent overlap
        compact ? "h-auto" : "h-full",
        isUnavailable && "opacity-90"
      )}
    >
      {/* Image Section - Flat edges on radius */}
      <div 
        ref={imageContainerRef} 
        className="relative overflow-hidden w-full rounded-t-sm bg-slate-100" 
        style={{ paddingBottom: '65%' }}
      >
        {!imageLoaded && !imageError && (
          <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        )}
        
        {shouldLoadImage && !imageLoaded && !imageError && (
          <img 
            src={thumbnailUrl} 
            alt="" 
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-md scale-110"
          />
        )}
        
        {shouldLoadImage && !imageError && (
          <img 
            src={optimizedImageUrl} 
            alt={name}
            loading={priority ? "eager" : "lazy"}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={cn(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105", 
                imageLoaded ? "opacity-100" : "opacity-0",
                isUnavailable && "grayscale-[0.6]" 
            )} 
          />
        )}
        
        {imageError && (
          <div className="absolute inset-0 w-full h-full bg-slate-100 flex items-center justify-center">
            <span className="text-slate-400 text-xs font-normal uppercase">No Image</span>
          </div>
        )}

        {isUnavailable && (
          <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
            <Badge className="bg-white text-black font-medium border-none px-4 py-1.5 text-[11px] uppercase rounded-none">
                {isSoldOut ? 'Sold Out' : 'Not Available'}
            </Badge>
          </div>
        )}
        
        <Badge 
          className="absolute top-3 left-3 z-10 px-2 py-0.5 border-none text-[8px] font-normal uppercase tracking-wider rounded-none"
          style={{ background: isUnavailable ? '#64748b' : COLORS.TEAL, color: 'white' }}
        >
          {displayType}
        </Badge>


        {onSave && (
          <button 
            onClick={handleSaveClick}
            className={cn(
                "absolute top-3 right-3 z-20 h-8 w-8 flex items-center justify-center rounded-none backdrop-blur-md transition-all active:scale-95", 
                isSavedLocal ? "bg-red-500" : "bg-black/20 hover:bg-black/40"
            )}
          >
            <Heart className={cn("h-4 w-4", isSavedLocal ? "text-white fill-white" : "text-white")} />
          </button>
        )}
      </div>
      
      {/* Content Section */}
      <div className="p-4 flex flex-col flex-1"> 
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-base md:text-lg leading-snug tracking-tight line-clamp-2" 
              style={{ color: isUnavailable ? '#475569' : COLORS.TEAL }}>
            {formattedName}
          </h3>
          {avgRating && (
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-none border border-slate-100 shadow-sm">
              <Star className="h-3 w-3 fill-[#FF7F50] text-[#FF7F50]" />
              <span className="text-[11px] font-normal text-slate-700">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: isUnavailable ? '#94a3b8' : COLORS.CORAL }} />
            <p className="text-[11px] font-bold text-black capitalize tracking-normal line-clamp-1">
                {locationString.toLowerCase()}
            </p>
        </div>

        {activities && activities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {activities.slice(0, 3).map((act, i) => (
              <span key={i} className={cn(
                "text-[10px] font-normal px-2 py-0.5 rounded-none capitalize border",
                isUnavailable ? "border-slate-200 text-slate-400" : "border-[#F0E68C] text-[#5c5829] bg-[#F0E68C]/10"
              )}>
                {typeof act === 'string' ? act : act.name}
              </span>
            ))}
          </div>
        )}
        
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex flex-col">
                {!hidePrice && price != null && (
                  <>
                    <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">
                      {(type === 'ADVENTURE PLACE' || type === 'HOTEL' || type === 'ACCOMMODATION') ? 'Entry Fee' : 'Starts at'}
                    </span>
                    <span className={cn("text-sm font-bold", isUnavailable ? "text-slate-300 line-through" : "text-[#FF0000]")}>
                        KSh {price.toLocaleString()}
                    </span>
                  </>
                )}
            </div>

            <div className="flex flex-col items-end">
                {(date || isFlexibleDate) && (
                  <div className="flex items-center gap-1 text-slate-500">
                      <Calendar className="h-3 w-3" />
                      <span className={`text-[10px] font-bold uppercase ${isFlexibleDate ? 'text-emerald-600' : ''}`}>
                          {isFlexibleDate ? 'Flexible' : new Date(date!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                  </div>
                )}
                
                <div className="mt-1">
                  {isOutdated ? (
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Passed</span>
                  ) : isSoldOut ? (
                    <span className="text-[9px] font-bold text-red-600 uppercase">Sold Out</span>
                  ) : fewSlotsRemaining ? (
                    <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                        <Ticket className="h-2.5 w-2.5" />
                        {remainingTickets} left
                    </span>
                  ) : (tracksAvailability && availableTickets > 0) && (
                    <span className="text-[9px] font-bold text-teal-600 uppercase">
                        {remainingTickets} Available
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
