import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestionSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  type: "trip" | "hotel" | "adventure" | "attraction";
  location?: string;
  country?: string;
  activities?: any;
}

export const SearchBarWithSuggestions = ({ value, onChange, onSubmit, onSuggestionSearch, onFocus, onBlur }: SearchBarProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Effect to handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Effect to fetch suggestions when the value changes or the search bar is focused
  useEffect(() => {
    if (showSuggestions) {
      fetchSuggestions();
    }
  }, [value, showSuggestions]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim();

    try {
      // Fetch all items when empty, or filter when typing
      const [tripsData, hotelsData, adventuresData, attractionsData] = await Promise.all([
        queryValue 
          ? supabase.from("trips").select("id, name, location, country, activities").eq("approval_status", "approved").or(`name.ilike.%${queryValue}%,location.ilike.%${queryValue}%,country.ilike.%${queryValue}%,activities::text.ilike.%${queryValue}%`).limit(20)
          : supabase.from("trips").select("id, name, location, country, activities").eq("approval_status", "approved").limit(20),
        queryValue
          ? supabase.from("hotels").select("id, name, location, country, activities, facilities").eq("approval_status", "approved").or(`name.ilike.%${queryValue}%,location.ilike.%${queryValue}%,country.ilike.%${queryValue}%,activities::text.ilike.%${queryValue}%,facilities::text.ilike.%${queryValue}%`).limit(20)
          : supabase.from("hotels").select("id, name, location, country, activities, facilities").eq("approval_status", "approved").limit(20),
        queryValue
          ? supabase.from("adventure_places").select("id, name, location, country, activities, facilities").eq("approval_status", "approved").or(`name.ilike.%${queryValue}%,location.ilike.%${queryValue}%,country.ilike.%${queryValue}%,activities::text.ilike.%${queryValue}%,facilities::text.ilike.%${queryValue}%`).limit(20)
          : supabase.from("adventure_places").select("id, name, location, country, activities, facilities").eq("approval_status", "approved").limit(20),
        queryValue
          ? supabase.from("attractions").select("id, location_name, country").eq("approval_status", "approved").or(`location_name.ilike.%${queryValue}%,country.ilike.%${queryValue}%`).limit(20)
          : supabase.from("attractions").select("id, location_name, country").eq("approval_status", "approved").limit(20)
      ]);

      let combined = [
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

      // Sort alphabetically by name
      combined.sort((a, b) => a.name.localeCompare(b.name));

      setSuggestions(combined.slice(0, 20));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const getActivitiesText = (activities: any) => {
    if (!activities) return "";
    if (Array.isArray(activities)) {
      return activities.slice(0, 3).join(", ");
    }
    if (typeof activities === "object") {
      const activityList = Object.values(activities).filter(Boolean);
      return activityList.slice(0, 3).join(", ");
    }
    return "";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      onSubmit();
    }
  };

  const handleSuggestionClick = (result: SearchResult) => {
    setShowSuggestions(false);
    // If onSuggestionSearch is provided, trigger search instead of navigation
    if (onSuggestionSearch) {
      onChange(result.name);
      onSuggestionSearch(result.name);
    } else {
      // Otherwise navigate to detail page
      navigate(`/${result.type}/${result.id}`);
    }
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
    <div ref={wrapperRef} className="relative w-full mx-auto">
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
        onFocus={() => {
          setShowSuggestions(true);
          onFocus?.();
        }}
        onBlur={onBlur}
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto z-[150]">
          {suggestions.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSuggestionClick(result)}
              className="w-full px-4 py-3 flex flex-col gap-1 hover:bg-accent transition-colors text-left border-b last:border-b-0"
            >
              <p className="font-medium text-sm">{result.name}</p>
              <p className="text-xs text-muted-foreground">
                {result.location && `${result.location}, `}{result.country} • {getTypeLabel(result.type)}
              </p>
              {getActivitiesText(result.activities) && (
                <p className="text-xs text-primary font-medium">
                  {getActivitiesText(result.activities)}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};