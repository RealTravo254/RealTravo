import { MapPin, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, optimizeSupabaseImage, generateImageSrcSet } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ListingCardProps {
  id: string;
  type: "TRIP" | "EVENT" | "HOTEL" | "ADVENTURE PLACE" | "ACCOMMODATION" | "ATTRACTION";
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
  hidePrice?: boolean;
  availableTickets?: number;
  bookedTickets?: number;
  showBadge?: boolean;
  priority?: boolean;
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
  hidePrice = false,
  availableTickets,
  bookedTickets,
  showBadge = false,
  priority = false,
}: ListingCardProps) => {
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
    navigate(`/${typeMap[type]}/${id}`);
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

  return (
    <Card 
      onClick={handleCardClick}
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border rounded-lg bg-card shadow-sm
                 w-full" 
    >
      <div className="relative aspect-[4/3] overflow-hidden m-0">
        <img
          src={optimizeSupabaseImage(imageUrl, { width: 640, height: 480, quality: 85 })}
          srcSet={generateImageSrcSet(imageUrl, [320, 640, 960])}
          sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 640px"
          alt={name}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 m-0 p-0"
        />
        
        {(type === "EVENT" || type === "TRIP") && showBadge && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground backdrop-blur text-xs font-bold z-10 px-2 py-1">
            {type}
          </Badge>
        )}
        
        {showBadge && type !== "EVENT" && type !== "TRIP" && (
          <Badge className="absolute top-2 left-2 bg-red-600 text-white backdrop-blur text-[0.6rem] z-10 p-1">
            {type}
          </Badge>
        )}

        {onSave && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveClick}
            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur hover:bg-background/90"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                isSaved ? "fill-primary text-primary" : "text-foreground"
              )}
            />
          </Button>
        )}

        {!hidePrice && price !== undefined && (type === "TRIP" || type === "EVENT") && (
          <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-3 py-1.5 md:px-2 md:py-1 rounded-full shadow-lg z-10">
            <p className="font-bold text-sm md:text-xs whitespace-nowrap">
              KSh {price}
            </p>
          </div>
        )}

        {(date || isCustomDate) && (
          <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur text-foreground px-2 py-1 rounded-md shadow-md z-10">
            <p className="text-xs font-semibold">
              {isCustomDate ? "Custom Date" : formatDate(date)}
            </p>
          </div>
        )}
      </div>
      
      <div className="p-3 md:p-4 flex flex-col space-y-2">
        <h3 className="font-bold text-sm md:text-base line-clamp-2">
          {name}
        </h3>
        
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
            {location}, {country}
          </p>
        </div>
        
        {type === "TRIP" && availableTickets !== undefined && (availableTickets - (bookedTickets || 0)) < 20 && (
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <p className="text-xs md:text-sm font-medium text-muted-foreground">
              Tickets Remaining:
            </p>
            <p className={cn(
              "text-xs md:text-sm font-bold",
              (availableTickets - (bookedTickets || 0)) <= 5 ? "text-destructive" : "text-green-600 dark:text-green-400"
            )}>
              {Math.max(0, availableTickets - (bookedTickets || 0))}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
