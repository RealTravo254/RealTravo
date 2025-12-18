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
  activities?: any[]; // Array of strings or objects
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

  const { ref: imageContainerRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px',
    triggerOnce: true
  });

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
    if (onSave) onSave(id, type);
  };

  const tealBgClass = "bg-[rgb(0,128,128)] text-white";
  const tealTextClass = "text-[rgb(0,100,100)]";
  const remainingTickets = availableTickets !== undefined ? availableTickets - (bookedTickets || 0) : undefined;
  const fewSlotsRemaining = (type === "TRIP" || type === "EVENT") && remainingTickets !== undefined && remainingTickets > 0 && remainingTickets <= 20;
  const isTripOrEvent = type === "TRIP" || type === "EVENT";

  // Optimized image URL - Higher resolution to account for bigger card size
  const optimizedImageUrl = optimizeSupabaseImage(imageUrl, {
    width: 450,
    height: 450,
    quality: 80
  });

  return (
    <Card 
      onClick={handleCardClick} 
      className={cn(
        "group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border bg-card shadow-md flex flex-col",
        // BORDER RADIUS & SIZE INCREASES
        "rounded-2xl", 
        "w-full max-w-sm mx-auto", // Max width constraint to keep it elegant
        compact ? "h-auto" : "min-h-[500px]" // Vertical growth
      )}
    >
      {/* Image Container - Increased ratio from 75% to 95% for 30% taller look */}
      <div 
        ref={imageContainerRef} 
        className="relative overflow-hidden m-0 bg-muted" 
        style={{ paddingBottom: '95%' }} 
      >
        {(!shouldLoadImage || (!imageLoaded && !imageError)) && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        {shouldLoadImage && (
          <img 
            src={optimizedImageUrl} 
            alt={name} 
            loading="lazy" 
            decoding="async" 
            onLoad={() => setImageLoaded(true)} 
            onError={() => setImageError(true)} 
            className={cn(
              "absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-500 m-0 p-0", 
              imageLoaded ? "opacity-100" : "opacity-0"
            )} 
          />
        )}
        
        {imageError && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-xs">No image</span>
          </div>
        )}
        
        {/* Type Badges */}
        {(type === "TRIP" || type === "EVENT") ? (
          <Badge className={cn("absolute top-3 left-3 backdrop-blur text-xs z-10 px-2 py-1 shadow-sm", tealBgClass, "lowercase")}>
            {type.toLowerCase()}
          </Badge>
        ) : (
          showBadge && (
            <Badge className={cn("absolute top-3 left-3 backdrop-blur text-[10px] z-10 px-2 py-1 shadow-sm", tealBgClass, "lowercase")}>
              {type.toLowerCase()}
            </Badge>
          )
        )}

        {onSave && (
          <Button 
            size="icon" 
            onClick={handleSaveClick} 
            className="absolute top-3 right-3 z-20 h-9 w-9 p-0 bg-white/80 hover:bg-white backdrop-blur-sm rounded-full transition-transform active:scale-90"
          >
            <Heart className={cn("h-5 w-5", isSaved ? "text-red-500 fill-red-500" : "text-slate-600 stroke-[2]")} />
          </Button>
        )}
      </div>
      
      {/* Content Area - More padding for larger card */}
      <div className="p-4 md:p-6 flex flex-col space-y-3 flex-1"> 
        <h3 className="font-bold text-sm md:text-lg leading-tight line-clamp-2 uppercase tracking-tight">
          {name.toUpperCase()}
        </h3>
        
        <div className="flex items-center gap-1.5">
          <MapPin className={cn("h-4 w-4 flex-shrink-0", tealTextClass)} />
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1 flex-1">
            {location}, {country}
          </p>
        </div>

        {/* NEW: ACTIVITIES SECTION */}
        {activities && activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-1">
            {activities.slice(0, 3).map((act, idx) => (
              <span 
                key={idx} 
                className="text-[10px] md:text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200"
              >
                {typeof act === 'string' ? act : act.name}
              </span>
            ))}
            {activities.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{activities.length - 3}</span>
            )}
          </div>
        )}
        
        {/* Footer Area */}
        {!minimalDisplay && (
          <div className={cn(
            "flex flex-col gap-2 pt-3 border-t border-border/60 mt-auto",
            hideEmptySpace && hidePrice && !date ? 'hidden' : ''
          )}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                {!hidePrice && price !== undefined && price > 0 && (
                  <span className="text-sm md:text-base font-black text-[rgb(180,0,0)]">
                    KSh {price.toLocaleString()}
                  </span>
                )}
                {date && (
                  <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
                    {isCustomDate ? "Flexible Date" : formatDate(date)}
                  </span>
                )}
              </div>

              {fewSlotsRemaining && (
                <Badge variant="destructive" className="text-[9px] md:text-[10px] px-2 py-0 animate-pulse uppercase">
                  Few slots left!
                </Badge>
              )}
            </div>

            {/* Inline Distance for non-trips */}
            {distance !== undefined && !isTripOrEvent && (
              <span className={cn("text-[10px] font-semibold", tealTextClass)}>
                📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};