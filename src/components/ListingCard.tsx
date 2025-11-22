import { Heart, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
}: ListingCardProps) => {
  const [saved, setSaved] = useState(isSaved);
  const navigate = useNavigate();

  // 💾 DATABASE INTERACTION LOGIC (UNCHANGED)
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if user is logged in
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) {
      // Redirect to login with a message
      navigate("/auth");
      return;
    }

    setSaved(!saved);
    onSave?.(id, type.toLowerCase().replace(" ", "_"));
  };

  // 🗺️ NAVIGATION LOGIC (UNCHANGED)
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

  // Function to format the date as 'Month Day, Year' (UNCHANGED)
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <Card 
      onClick={handleCardClick}
      // Adjusted width for small screens (e.g., max-w-[180px] or w-full on larger)
      // and smaller overall padding/font sizes
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 rounded-none
                 max-w-[160px] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg" 
    >
      <div 
        className="relative aspect-[4/3] overflow-hidden" 
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        
        {/* Category Badge - Top-Left - Only show when showBadge is true */}
        {showBadge && (
          <Badge className="absolute top-2 left-2 bg-red-600 text-white backdrop-blur text-[0.6rem] z-10 p-1">
            {type}
          </Badge>
        )}

        {/* Save Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className={cn(
            "absolute top-2 right-2 h-7 w-7 rounded-full transition-all z-10 text-red-500 hover:bg-blue-500 hover:text-white"
          )}
        >
          <Heart
            className={cn(
              "h-3 w-3 transition-all", // Smaller icon
              saved ? "fill-red-500 text-red-500" : "text-red-500"
            )}
          />
        </Button>

        {/* Price Overlay - Bottom-Right of Image - Only for TRIP */}
        {!hidePrice && type === "TRIP" && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex justify-end items-end">
            {price !== undefined && (
              <p className="font-bold text-xs text-white"> 
                KSh {price}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Name, Location, and Date Details - Below the image */}
      <div className="p-1.5 flex flex-col space-y-0.5"> {/* Smaller padding and spacing */}
        {/* MODIFIED CODE FOR NAME DISPLAY */}
        <h3 className="font-bold text-xs line-clamp-1">
          {type === "ADVENTURE PLACE" ? "experience" : name}
        </h3>

        {/* LOCATION - Left below title name with icon */}
        <div className="flex items-center space-x-0.5 text-[0.6rem] text-gray-600 dark:text-gray-400"> {/* Smaller font and spacing */}
          <MapPin className="h-3 w-3 shrink-0" /> {/* Smaller icon */}
          <p className="line-clamp-1">
            {location}, {country}
          </p>
        </div>
        
        {/* DATE row */}
        {(date || isCustomDate) && (
          <div className="flex justify-between items-center pt-0.5">
            <p className="text-[0.6rem] font-semibold text-red-600 dark:text-red-400"> {/* Smaller font */}
              {isCustomDate ? "Custom" : formatDate(date)}
            </p>
          </div>
        )}
        
        {/* EVENT CAPACITY - Only for events */}
        {type === "EVENT" && availableTickets !== undefined && (
          <div className="flex items-center justify-between pt-0.5 border-t border-border/50 mt-0.5">
            <p className="text-[0.6rem] font-medium text-muted-foreground"> {/* Smaller font */}
              Tickets Remaining:
            </p>
            <p className={cn(
              "text-[0.6rem] font-bold", // Smaller font
              (availableTickets - (bookedTickets || 0)) <= 5 ? "text-destructive" : "text-green-600 dark:text-green-400"
            )}>
              {Math.max(0, availableTickets - (bookedTickets || 0))} / {availableTickets}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};