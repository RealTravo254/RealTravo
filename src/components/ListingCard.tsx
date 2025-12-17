import { useState } from "react";
import { MapPin, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
interface ListingCardProps {
  id: string;
  type: 'TRIP' | 'EVENT' | 'HOTEL' | 'ADVENTURE PLACE' | 'ACCOMMODATION' | 'ATTRACTION';
  name: string;
  imageUrl: string;
  location: string;
  country: string;
  price?: number;
  date?: string;
  isCustomDate?: boolean;
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
}
export const ListingCard = ({
  id,
  type,
  name,
  imageUrl,
  location,
  country,
  price,
  date,
  isCustomDate = false,
  onSave,
  isSaved = false,
  amenities,
  activities,
  hidePrice = false,
  availableTickets,
  bookedTickets,
  showBadge = false,
  priority = false,
  minimalDisplay = false,
  hideEmptySpace = false,
  compact = false,
  distance
}: ListingCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Use intersection observer for lazy loading - load when 200px before entering viewport
  const {
    ref: imageContainerRef,
    isIntersecting
  } = useIntersectionObserver({
    rootMargin: '200px',
    triggerOnce: true
  });

  // For priority images, always load immediately
  const shouldLoadImage = priority || isIntersecting;
  const navigate = useNavigate();
  const handleCardClick = () => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip",
      "EVENT": "event",
      "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure",
      "ACCOMMODATION": "accommodation",
      "ATTRACTION": "attraction"
    };
    const path = createDetailPath(typeMap[type], id, name, location);
    navigate(path);
  };
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave) {
      onSave(id, type);
    }
  };
  const tealBgClass = "bg-[rgb(0,128,128)] text-white";
  const tealTextClass = "text-[rgb(0,100,100)]";
  const remainingTickets = availableTickets !== undefined ? availableTickets - (bookedTickets || 0) : undefined;
  const fewSlotsRemaining = (type === "TRIP" || type === "EVENT") && remainingTickets !== undefined && remainingTickets > 0 && remainingTickets <= 20;
  const isTripOrEvent = type === "TRIP" || type === "EVENT";

  // Optimized image URL - smaller size for faster loading
  const optimizedImageUrl = optimizeSupabaseImage(imageUrl, {
    width: 320,
    height: 200,
    quality: 70
  });
  return <Card onClick={handleCardClick} className={cn("group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border bg-card shadow-sm w-full flex flex-col",
    // Changed "rounded-lg" to "rounded-none" to remove border radius
    "rounded-none", compact ? "h-auto" : "h-auto")}>
      {/* Image Container with intersection observer */}
      {/* INCREASED paddingBottom from '60%' to '75%' for a taller card */}
      <div ref={imageContainerRef} className="relative overflow-hidden m-0 bg-muted" style={{
      paddingBottom: '75%'
    }}>
        {/* Skeleton placeholder - show when not loading or image not loaded */}
        {(!shouldLoadImage || !imageLoaded && !imageError) && <div className="absolute inset-0 bg-muted animate-pulse" />}
        
        {/* Actual image - only render when in viewport */}
        {shouldLoadImage && <img src={optimizedImageUrl} alt={name} width={320} height={200} loading="lazy" decoding="async" onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} className={cn("absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-300 m-0 p-0", imageLoaded ? "opacity-100" : "opacity-0")} />}
        
        {/* Error fallback */}
        {imageError && <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs">No image</span>
            </div>}
        
        {/* Category Badges */}
        {/* TRIP Badge (Lowercase, not bold) */}
        {type === "TRIP" && <Badge className={cn("absolute top-1.5 left-1.5 backdrop-blur text-[10px] md:text-xs z-10 px-1.5 py-0.5 md:px-2 md:py-1", tealBgClass, "lowercase")}>
            trip
        </Badge>}

        {/* EVENT Badge - ADDED (Lowercase, not bold) */}
        {type === "EVENT" && <Badge className={cn("absolute top-1.5 left-1.5 backdrop-blur text-[10px] md:text-xs z-10 px-1.5 py-0.5 md:px-2 md:py-1", tealBgClass, "lowercase")}>
            event
        </Badge>}

        {/* Other Types Badge (Lowercase, not bold, only when showBadge is true) */}
        {type !== "EVENT" && type !== "TRIP" && showBadge && <Badge className={cn("absolute top-1.5 left-1.5 backdrop-blur text-[8px] md:text-[0.6rem] z-10 px-1 py-0.5 md:p-1", tealBgClass, "lowercase")}>
            {type.toLowerCase()}
        </Badge>}

        {onSave && <Button size="icon" onClick={handleSaveClick} aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"} className={cn("absolute top-1.5 right-1.5 z-20 h-8 w-8 md:h-8 md:w-8 p-0 bg-transparent touch-manipulation active:scale-95 transition-transform", "border-none shadow-none", "outline-none focus-visible:ring-0 focus-visible:bg-transparent hover:bg-transparent")}>
            <Heart className={cn("h-4 w-4 md:h-4 md:w-4", isSaved ? "text-red-500 fill-red-500" : "text-black stroke-[2.5] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]")} />
        </Button>}
      </div>
      
      {/* Content Area */}
      <div className="p-2 md:p-4 flex flex-col space-y-1 md:space-y-2 flex-1"> 
        {/* Name is now consistently uppercase */}
        <h3 className="font-bold text-xs md:text-base line-clamp-2 uppercase">
            {name.toUpperCase()}
        </h3>
        
        {/* Location - Always visible */}
        <div className="flex items-center gap-1 flex-wrap">
            <MapPin className={cn("h-3 w-3 flex-shrink-0", tealTextClass)} />
            <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-1 flex-1">
                {location}
            </p>
            {/* Distance inline for non-trip/event types */}
            {distance !== undefined && type !== "TRIP" && type !== "EVENT" && <span className={cn("text-[8px] md:text-xs px-1.5 py-0.5 rounded-full bg-primary/10 font-medium whitespace-nowrap", tealTextClass)}>
                        📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                    </span>}
        </div>
        
        {/* Price, Date and Few slots remaining for Trips/Events - on same row */}
        {isTripOrEvent && !minimalDisplay && <div className={`flex items-center justify-between gap-1 pt-1 border-t border-border/50 mt-auto ${hideEmptySpace && hidePrice && !date ? 'hidden' : ''}`}> 
            <div className="flex items-center gap-2 flex-wrap">
                {!hidePrice && price !== undefined && price > 0 && <span className="text-[10px] md:text-xs font-bold text-[rgb(200,0,0)]">
                    KSh {price.toLocaleString()}
                </span>}
                {date && !isCustomDate && <span className="text-[10px] md:text-xs text-muted-foreground">
                    {formatDate(date)}
                </span>}
                {isCustomDate && <span className="text-[10px] md:text-xs text-muted-foreground italic">
                    Flexible Date
                </span>}
            </div>
            {fewSlotsRemaining && <span className="text-[8px] md:text-[10px] font-medium text-[rgb(180,0,0)] px-1 py-0.5 bg-red-100 rounded-sm whitespace-nowrap">
                Few left!
            </span>}
        </div>}
      </div>
    </Card>;
};