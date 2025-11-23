import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  type: "trip" | "hotel" | "adventure" | "attraction";
  location?: string;
  country?: string;
  activities?: any;
}

export const SearchBarWithSuggestions = ({ value, onChange, onSubmit }: SearchBarProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  // Effect to fetch suggestions when the value changes or the search bar is focused
  useEffect(() => {
    // Only fetch if value is 2+ chars OR if the suggestions panel is currently visible (onFocus/tap)
    if (value.trim().length >= 2 || (showSuggestions && value.trim().length === 0)) {
      fetchSuggestions();
    } else if (value.trim().length < 2) {
      // Clear suggestions if the search text is too short
      setSuggestions([]);
    }
  }, [value, showSuggestions]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim();
    if (!queryValue) {
      setSuggestions([]);
      return;
    }

    const searchPattern = `%${queryValue}%`;
    
    try {
      const [tripsData, hotelsData, adventuresData, attractionsData] = await Promise.all([
        supabase.from("trips").select("id, name, location, country, activities").or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`).limit(5),
        supabase.from("hotels").select("id, name, location, country, activities").or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`).limit(5),
        supabase.from("adventure_places").select("id, name, location, country, activities").or(`name.ilike.${searchPattern},location.ilike.${searchPattern},country.ilike.${searchPattern}`).limit(5),
        supabase.from("attractions").select("id, location_name, country").or(`location_name.ilike.${searchPattern},country.ilike.${searchPattern}`).limit(5)
      ]);

      const combined = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(hotelsData.data || []).map((item) => ({ ...item, type: "hotel" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const })),
        ...(attractionsData.data || []).map((item) => ({ 
          ...item, 
          type: "attraction" as const, 
          name: item.location_name,
          location: item.location_name
        }))
      ];

      setSuggestions(combined.slice(0, 8));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      onSubmit();
    }
  };

  const handleSuggestionClick = (result: SearchResult) => {
    setShowSuggestions(false);
    // Navigates to the detail page using the item's type and ID, e.g., /trip/abc-123
    navigate(`/${result.type}/${result.id}`);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "trip":
        return "Trip";
      case "hotel":
        return "Hotel";
      case "adventure":
        return "Adventure Place";
      case "attraction":
        return "Attraction";
      default:
        return type;
    }
  };

  return (
    <div className="relative w-full mx-auto">
      <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground z-10" />
      <Input
        type="text"
        placeholder="Search for trips, events, hotels, places, or countries..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyPress={handleKeyPress}
        onFocus={() => setShowSuggestions(true)}
        className="pl-10 md:pl-12 pr-20 md:pr-24 h-10 md:h-14 text-sm md:text-lg rounded-full border-2 focus-visible:border-primary shadow-md"
      />
      <Button
        onClick={onSubmit}
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-8 md:h-12 px-4 md:px-6"
      >
        Search
      </Button>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto z-[100]">
          {suggestions.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSuggestionClick(result)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent transition-colors text-left border-b last:border-b-0"
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{result.name}</p>
                <p className="text-xs text-muted-foreground">
                  {result.location && `${result.location}, `}{result.country} • {getTypeLabel(result.type)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};