import { useState, useEffect, useRef } from "react";
import { Clock, X, TrendingUp, Plane, Hotel, Tent, Landmark, ArrowLeft } from "lucide-react";
import { getSessionId } from "@/lib/sessionManager";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestionSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: "trip" | "hotel" | "adventure" | "attraction";
  location?: string;
  country?: string;
  activities?: any;
}

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY_ITEMS = 10;

interface TrendingSearch {
  query: string;
  search_count: number;
}

export const SearchBarWithSuggestions = ({ value, onChange, onSubmit, onSuggestionSearch, onFocus, onBlur, onBack, showBackButton = false }: SearchBarProps) => {
  const { user } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load search history and trending searches from database
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
    fetchTrendingSearches();
  }, []);

  const fetchTrendingSearches = async () => {
    try {
      const { data, error } = await supabase.rpc('get_trending_searches', { limit_count: 10 });
      if (!error && data) {
        setTrendingSearches(data);
      }
    } catch (error) {
      console.error("Error fetching trending searches:", error);
    }
  };

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

  const saveToHistory = async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Save to localStorage
    const updatedHistory = [
      trimmedQuery,
      ...searchHistory.filter(item => item !== trimmedQuery)
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(updatedHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));

    // Save to database for trending searches
    try {
      await supabase.from('search_queries').insert({
        query: trimmedQuery,
        user_id: user?.id || null,
        session_id: user ? null : getSessionId()
      });
      // Refresh trending searches
      fetchTrendingSearches();
    } catch (error) {
      console.error("Error saving search query:", error);
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const removeHistoryItem = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = searchHistory.filter(h => h !== item);
    setSearchHistory(updatedHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setShowSuggestions(false);
      saveToHistory(value);
      onSubmit();
    }
  };

  const handleSuggestionClick = (result: SearchResult) => {
    setShowSuggestions(false);
    saveToHistory(result.name);
    // If onSuggestionSearch is provided, trigger search instead of navigation
    if (onSuggestionSearch) {
      onChange(result.name);
      onSuggestionSearch(result.name);
    } else {
      // Otherwise navigate to detail page
      navigate(`/${result.type}/${result.id}`);
    }
  };

  const handleHistoryClick = (historyItem: string) => {
    onChange(historyItem);
    setShowSuggestions(false);
    if (onSuggestionSearch) {
      onSuggestionSearch(historyItem);
    } else {
      onSubmit();
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "trip":
        return "Trip";
      case "hotel":
        return "Hotel";
      case "adventure":
        return "Campsite";
      case "attraction":
        return "Attraction";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "trip":
        return Plane;
      case "hotel":
        return Hotel;
      case "adventure":
        return Tent;
      case "attraction":
        return Landmark;
      default:
        return Plane;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full mx-auto">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search for trips, hotels, campsites, attractions, or countries..."
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
            onClick={() => {
              saveToHistory(value);
              onSubmit();
            }}
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-8 md:h-12 px-4 md:px-6"
          >
            Search
          </Button>
        </div>
      </div>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto z-[150]" style={{ marginLeft: showBackButton ? '0' : '0' }}>
          {/* Show search history and trending when no value */}
          {!value.trim() && (
            <div>
              {searchHistory.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Recent Searches</p>
                    </div>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(item)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors text-left border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{item}</p>
                      </div>
                      <button
                        onClick={(e) => removeHistoryItem(item, e)}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </button>
                  ))}
                </>
              )}

              {trendingSearches.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Trending Searches</p>
                  </div>
                  {trendingSearches.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(item.query)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors text-left border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <p className="text-sm">{item.query}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.search_count} searches
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Show search suggestions when typing */}
          {value.trim() && suggestions.length > 0 && (
            <>
              {suggestions.map((result) => {
                const TypeIcon = getTypeIcon(result.type);
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSuggestionClick(result)}
                    className="w-full px-4 py-3 flex flex-col gap-1 hover:bg-accent transition-colors text-left border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <TypeIcon className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex flex-col">
                          <p className="font-semibold text-base">{result.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.location && `${result.location}, `}{result.country}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    {getActivitiesText(result.activities) && (
                      <p className="text-xs text-primary font-medium pl-7">
                        {getActivitiesText(result.activities)}
                      </p>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};