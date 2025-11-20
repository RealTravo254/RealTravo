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
  type: "TRIP" | "EVENT" | "HOTEL" | "ADVENTURE PLACE" | "ACCOMMODATION";
  name: string;
  imageUrl: string;
  location: string;
  country: string;
  price?: number;
  date?: string;
  onSave?: (id: string, type: string) => void;
  isSaved?: boolean;
  amenities?: string[];
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
  onSave,
  isSaved = false,
  amenities,
}: ListingCardProps) => {
  const [saved, setSaved] = useState(isSaved);
  const navigate = useNavigate();

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

  const handleCardClick = () => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip",
      "EVENT": "event",
      "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure",
      "ACCOMMODATION": "accommodation"
    };
    navigate(`/${typeMap[type]}/${id}`);
  };

  // Function to format the date as 'Month Day, Year'
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
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 rounded-lg" 
    >
      <div 
        className="relative aspect-[4/3] overflow-hidden" 
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        
        {/* Category Badge - Top-Left */}
        <Badge className="absolute top-3 left-3 bg-red-600 text-white backdrop-blur text-xs z-10">
          {type}
        </Badge>

        {/* Save Button (Red, no background, hover blue) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 rounded-full transition-all z-10 text-red-500 hover:bg-blue-500 hover:text-white"
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all",
              saved ? "fill-red-500 text-red-500" : "text-red-500"
            )}
          />
        </Button>

        {/* Price Overlay - Bottom-Right of Image (Original location was bottom of image, adjusted Price to be on the right side of the bottom image overlay) */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-end items-end">
          {/* Price - Right Side of Image Overlay */}
          {price !== undefined && (
            <p className="font-bold text-sm md:text-lg text-white"> 
              KSh {price}
            </p>
          )}
        </div>
      </div>
      
      {/* Name, Location, and Date Details - Below the image */}
      <div className="p-4 pt-3 flex flex-col space-y-1">
        <h3 className="font-bold text-sm md:text-lg line-clamp-1">{name}</h3> 

        {/* LOCATION - Left below title name with icon */}
        <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
          <MapPin className="h-4 w-4 shrink-0" />
          <p className="line-clamp-1">
            {location}, {country}
          </p>
        </div>
        
        {/* DATE - Aligned to the bottom right of the list/card body */}
        <div className="flex justify-end pt-2">
            {date && (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400"> 
                    {formatDate(date)}
                </p>
            )}
        </div>
      </div>
    </Card>
  );
};