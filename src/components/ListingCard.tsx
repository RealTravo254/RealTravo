import { useState } from "react";
import { MapPin, Heart, Star } from "lucide-react";
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
  avgRating?: number;
  reviewCount?: number;
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
  distance,
  avgRating,
  reviewCount
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
      "TRIP": "trip", "EVENT": "event", "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure", "ACCOMMODATION": "accommodation", "ATTRACTION": "attraction"
    };
    const path = createDetailPath(typeMap[type], id, name, location);
    navigate(path);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
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

  const optimizedImageUrl = optimizeSupabaseImage(imageUrl, {
    width: 320, height: 200, quality: 70
  });

  return (
    <Card 
      onClick={handleCardClick} 
      className={cn(
        "group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border bg-card shadow-sm w-full flex flex-col",
        // BORDER RADIUS ADDED HERE
        "rounded-xl", 
        compact ? "h-auto" : "h-auto"
      )}
    >
      <div ref={imageContainerRef} className="relative overflow-hidden m-0 bg-muted" style={{ paddingBottom: '75%' }}>
        {(!shouldLoadImage || !imageLoaded && !imageError) && <div className="absolute inset-0 bg-muted animate-pulse" />}
        {shouldLoadImage && (
          <img 
            src={optimizedImageUrl} 
            alt={name} 
            onLoad={() => setImageLoaded(true)} 
            onError={() => setImageError(true)} 
            className={cn("absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-300", imageLoaded ? "opacity-100" : "opacity-0")} 
          />
        )}
        
        {/* Category Badges */}
        {(type === "TRIP" || type === "EVENT") && (
          <Badge className={cn("absolute top-1.5 left-1.5 backdrop-blur text-[10px] md:text-xs z-10 px-1.5 py-0.5 md:px-2 md:py-1", tealBgClass, "lowercase")}>
            {type.toLowerCase()}
          </Badge>
        )}

        {onSave && (
          <Button size="icon" onClick={handleSaveClick} className="absolute top-1.5 right-1.5 z-20 h-8 w-8 bg-transparent hover:bg-transparent border-none shadow-none">
            <Heart className={cn("h-4 w-4", isSaved ? "text-red-500 fill-red-500" : "text-black stroke-[2.5] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]")} />
          </Button>
        )}
      </div>
      
      <div className="p-2 md:p-4 flex flex-col space-y-1.5 flex-1"> 
        <h3 className="font-bold text-xs md:text-base line-clamp-2 uppercase">
            {name.toUpperCase()}
        </h3>
        
        {/* Star Rating Section */}
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 md:h-3.5 md:w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-[10px] md:text-xs font-semibold text-foreground">
            {avgRating ? avgRating.toFixed(1) : "0.0"}
          </span>
          <span className="text-[9px] md:text-[11px] text-muted-foreground">
            ({reviewCount || 0} {reviewCount === 1 ? "review" : "reviews"})
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-wrap">
            <MapPin className={cn("h-3 w-3 flex-shrink-0", tealTextClass)} />
            <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-1 flex-1">
                {location}
            </p>
        </div>

        {/* ACTIVITIES SECTION: Comma separated, max 5, theme-aware colors */}
        {activities && activities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <p className="text-[10px] md:text-xs font-medium text-black dark:text-white opacity-80">
              {activities.slice(0, 5).map((act, i) => (
                <span key={i}>
                  {typeof act === 'string' ? act : act.name}
                  {i < Math.min(activities.length, 5) - 1 ? ", " : ""}
                </span>
              ))}
              {activities.length > 5 && "..."}
            </p>
          </div>
        )}
        
        {isTripOrEvent && !minimalDisplay && (
          <div className={`flex items-center justify-between gap-1 pt-1 border-t border-border/50 mt-auto ${hideEmptySpace && hidePrice && !date ? 'hidden' : ''}`}> 
              <div className="flex items-center gap-2 flex-wrap">
                  {!hidePrice && price !== undefined && price > 0 && (
                    <span className="text-[10px] md:text-xs font-bold text-[rgb(200,0,0)]">
                        KSh {price.toLocaleString()}
                    </span>
                  )}
                  {date && <span className="text-[10px] md:text-xs text-muted-foreground">{formatDate(date)}</span>}
              </div>
              {fewSlotsRemaining && (
                <span className="text-[8px] md:text-[10px] font-medium text-[rgb(180,0,0)] px-1 py-0.5 bg-red-100 rounded-sm">
                    Few left!
                </span>
              )}
          </div>
        )}
      </div>
    </Card>
  );
};