import { Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ListingCardProps {
  id: string;
  type: "TRIP" | "EVENT" | "HOTEL" | "ADVENTURE PLACE";
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
      "ADVENTURE PLACE": "adventure"
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
      // Removed rounded-lg class for square corners
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 rounded-none" 
    >
      <div 
        // Removed rounded-t-lg class for square corners on the image container
        className="relative aspect-[4/3] overflow-hidden" 
      >
        <img
          src={imageUrl}
          alt={name}
          // The image now spans the full width of the card due to the parent container changes.
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

        {/* Price (Left) and Date (Right) Overlay - Bottom of Image */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
          {/* Price - Left Side */}
          {price !== undefined && (
            <p className="font-bold text-lg text-white"> 
              ${price}
            </p>
          )}
          {/* Date - Right Side */}
          {date && (
            <p className="font-bold text-xs text-white/90"> 
              {formatDate(date)}
            </p>
          )}
        </div>
      </div>
      
      {/* Name and Location Detail - Below the image, location at bottom right */}
      <div className="p-4 pt-3 flex flex-col space-y-1">
        <h3 className="font-bold text-lg line-clamp-1">{name}</h3> 
        {/* Location detail moved to the bottom right of this section */}
        <div className="flex justify-end">
             <p className="text-sm text-gray-500 line-clamp-1">{location}, {country}</p> 
        </div>
      </div>
    </Card>
  );
};