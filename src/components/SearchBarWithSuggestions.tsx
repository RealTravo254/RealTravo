import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  image_url: string;
  type: "trip" | "event" | "hotel" | "adventure";
}

export const SearchBarWithSuggestions = ({ value, onChange, onSubmit }: SearchBarProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  // 1. MODIFIED useEffect dependency and logic
  useEffect(() => {
    // Fetch suggestions if the value has at least 2 chars OR if the suggestions panel is currently visible
    if (value.trim().length >= 2 || showSuggestions) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [value, showSuggestions]); // Added showSuggestions to dependencies

  // 2. MODIFIED fetchSuggestions to handle empty query
  const fetchSuggestions = async () => {
    // If query is empty, use a placeholder that matches everything (or fetch popular/recent items)
    // For simplicity, we'll use a wildcard query that typically matches everything
    const queryValue = value.trim();
    const query = queryValue.length >= 2 ? `%${queryValue.toLowerCase()}%` : `%%`; // Use '%%' to match everything if search is empty
    const isFullQuery = queryValue.length >= 2;
    const results: SearchResult[] = [];

    // Construct the OR condition dynamically
    const orCondition = isFullQuery ? 
        `name.ilike.${query},location.ilike.${query},country.ilike.${query}` : 
        `name.ilike.${query}`; // Only search name if empty to reduce load, or use a specific list logic

    try {
      const [trips, events, hotels, places] = await Promise.all([
        supabase
          .from("trips")
          .select("id, name, image_url")
          .eq("approval_status", "approved")
          .or(orCondition)
          .limit(isFullQuery ? 3 : 2), // Limit results differently for empty vs specific search
        supabase
          .from("events")
          .select("id, name, image_url")
          .eq("approval_status", "approved")
          .or(orCondition)
          .limit(isFullQuery ? 3 : 2),
        supabase
          .from("hotels")
          .select("id, name, image_url")
          .eq("approval_status", "approved")
          .or(orCondition)
          .limit(isFullQuery ? 3 : 2),
        supabase
          .from("adventure_places")
          .select("id, name, image_url")
          .eq("approval_status", "approved")
          .or(orCondition)
          .limit(isFullQuery ? 3 : 2),
      ]);

      if (trips.data) {
        results.push(...trips.data.map((item) => ({ ...item, type: "trip" as const })));
      }
      if (events.data) {
        results.push(...events.data.map((item) => ({ ...item, type: "event" as const })));
      }
      if (hotels.data) {
        results.push(...hotels.data.map((item) => ({ ...item, type: "hotel" as const })));
      }
      if (places.data) {
        results.push(...places.data.map((item) => ({ ...item, type: "adventure" as const })));
      }

      setSuggestions(results.slice(0, 10));
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
    navigate(`/${result.type}/${result.id}`);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "trip":
        return "Trip";
      case "event":
        return "Event";
      case "hotel":
      case "adventure":
        return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
      default:
        return type;
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search for trips, events, hotels, places, or countries..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        // 3. Keep onFocus to immediately set showSuggestions to true
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="pl-10 md:pl-12 pr-3 md:pr-4 h-10 md:h-14 text-sm md:text-lg rounded-xl md:rounded-2xl border-2 focus-visible:border-primary shadow-md"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-xl shadow-lg max-h-96 overflow-y-auto">
          {suggestions.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors border-b last:border-b-0"
              onClick={() => handleSuggestionClick(result)}
            >
              <img
                src={result.image_url}
                alt={result.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm md:text-base line-clamp-1">{result.name}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{getTypeLabel(result.type)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  
};