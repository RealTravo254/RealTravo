import { MapPin, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, optimizeSupabaseImage, generateImageSrcSet } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
// Note: Assuming ListingCardProps interface is defined elsewhere
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
  minimalDisplay?: boolean; // Only show name and location
  hideEmptySpace?: boolean; // Hide space when no content to display
  compact?: boolean; // Smaller height, hide location
  distance?: number; // Distance in km from user's location
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
  // Extract activity names from activities array
  const getActivityNames = (activities: any[] | undefined): string[] => {
    if (!activities || !Array.isArray(activities)) return [];
    return activities.map(item => typeof item === 'object' && item.name ? item.name : typeof item === 'string' ? item : null).filter(Boolean).slice(0, 5) as string[];
  };
  const activityNames = getActivityNames(activities);
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

  // Define the custom Teal background and text classes (0, 128, 128)
  const tealBgClass = "bg-[rgb(0,128,128)] text-white";
  const tealTextClass = "text-[rgb(0,128,128)]";

  // --- MODIFICATION: Determine if "Few slots remaining" will be shown ---
  const remainingTickets = availableTickets !== undefined ? availableTickets - (bookedTickets || 0) : undefined;

  // Show "Few slots remaining" if it's a TRIP or EVENT and remaining tickets are 20 or less.
  const fewSlotsRemaining = (type === "TRIP" || type === "EVENT") && remainingTickets !== undefined && remainingTickets > 0 && remainingTickets <= 20;

  // Determine if the card is a type that uses the special price/date and ticket warning logic
  const isTripOrEvent = type === "TRIP" || type === "EVENT";
  return <Card onClick={handleCardClick} className={cn("group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border rounded-lg bg-card shadow-sm w-full flex flex-col", compact ? "h-[180px] sm:h-[200px]" : "h-[280px] sm:h-[300px] lg:h-[320px]")}>
            {/* Image Container */}
            <div className="relative overflow-hidden m-0" style={{
      paddingBottom: '65%'
    }}>
                <img src={optimizeSupabaseImage(imageUrl, {
        width: 640,
        height: 480,
        quality: 85
      })} srcSet={generateImageSrcSet(imageUrl, [320, 640, 960])} sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 640px" alt={name} width={640} height={480} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 m-0 p-0" />
                
                {/* Category Badges use Teal BG (0, 128, 128) */}
                {type === "TRIP" && <Badge className={cn("absolute top-2 left-2 backdrop-blur text-xs font-bold z-10 px-2 py-1", tealBgClass)}>
                        TRIP
                    </Badge>}

                {type === "EVENT" && <Badge className={cn("absolute top-2 left-2 backdrop-blur text-xs font-bold z-10 px-2 py-1", tealBgClass)}>
                        EVENT
                    </Badge>}

                {type !== "EVENT" && type !== "TRIP" && showBadge && <Badge className={cn("absolute top-2 left-2 backdrop-blur text-[0.6rem] z-10 p-1", tealBgClass)}>
                        {type}
                    </Badge>}


                {onSave && <Button size="icon" onClick={handleSaveClick} className={cn("absolute top-2 right-2 z-20 h-10 w-10 md:h-8 md:w-8 p-0 bg-transparent touch-manipulation active:scale-95 transition-transform", "border-none shadow-none", "outline-none focus-visible:ring-0 focus-visible:bg-transparent hover:bg-transparent")}>
                        <Heart className={cn("h-5 w-5 md:h-4 md:w-4", isSaved ? "text-red-500 fill-red-500" : "text-black stroke-[2.5] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]")} />
                    </Button>}
            </div>
            
            {/* Content Area - MODIFIED: Added flex-1 to make it take up remaining space */}
            <div className="p-2 md:p-4 flex flex-col space-y-1 md:space-y-2 flex-1"> 
                <h3 className="font-bold text-xs md:text-base line-clamp-2 py-[5px] my-px">
                    {name}
                </h3>
                
                {/* Location and Distance - Placed below Name */}
                <div className="flex items-center gap-1 flex-wrap">
                    <MapPin className={cn("h-3 w-3 flex-shrink-0", tealTextClass)} />
                    <p className="text-[10px] md:text-sm text-muted-foreground line-clamp-1">
                        {location}
                    </p>
                    {/* Distance inline for non-trip/event types */}
                    {distance !== undefined && type !== "TRIP" && type !== "EVENT" && (
                        <span className={cn("text-[8px] md:text-xs px-1.5 py-0.5 rounded-full bg-primary/10 font-medium whitespace-nowrap", tealTextClass)}>
                            📍 {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                        </span>
                    )}
                </div>

                {/* --- Activities Section for NON-TRIP/EVENT types --- */}
                {!minimalDisplay && !isTripOrEvent && activityNames.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 md:gap-1 pt-0.5 md:pt-1 flex-1 min-h-0 overflow-hidden items-start justify-start">
                        {activityNames.slice(0, 3).map((activity, index) => (
                            <span key={index} className={cn("text-[7px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full bg-muted", tealTextClass)}>
                                {activity}
                            </span>
                        ))}
                        {activityNames.length > 3 && (
                            <span className={cn("text-[7px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full bg-muted", tealTextClass)}>
                                +{activityNames.length - 3}
                            </span>
                        )}
                    </div>
                )}
                
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
                        {fewSlotsRemaining && <span className="text-[8px] md:text-[10px] font-medium text-destructive px-1 py-0.5 bg-destructive/10 rounded-sm whitespace-nowrap">
                                Few left!
                            </span>}
                    </div>}
            </div>
        </Card>;
};