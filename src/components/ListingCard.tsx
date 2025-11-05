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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Redirect to login
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

  return (
    <Card 
      onClick={handleCardClick}
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-none cursor-pointer"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-none">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-primary/90 text-primary-foreground backdrop-blur">
            {type}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className={cn(
            "absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur hover:bg-background transition-all",
            saved && "bg-primary/20 hover:bg-primary/30"
          )}
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-all",
              saved ? "fill-primary text-primary" : "text-muted-foreground"
            )}
          />
        </Button>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 line-clamp-1">{name}</h3>
        
        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          <p className="line-clamp-1">{location}</p>
          <p className="font-medium text-foreground">{country}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          {price !== undefined && (
            <p className="font-bold text-lg text-primary">${price}</p>
          )}
          {date && (
            <p className="text-sm text-muted-foreground">{new Date(date).toLocaleDateString()}</p>
          )}
        </div>
        
        {amenities && amenities.length > 0 && (
          <div className="hidden md:flex flex-wrap gap-1 mt-2">
            {amenities.slice(0, 4).map((amenity, index) => (
              <span key={index} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {amenity}
              </span>
            ))}
            {amenities.length > 4 && (
              <span className="text-xs text-muted-foreground px-2 py-1">+{amenities.length - 4} more</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
