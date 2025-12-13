import { useState, useEffect, useRef } from "react";
import { Clock, X, TrendingUp, Plane, Hotel, Tent, Landmark, ArrowLeft, Calendar, Search as SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSessionId } from "@/lib/sessionManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Define the requested Teal color
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#006666"; // A slightly darker teal for hover effects

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
  type: "trip" | "hotel" | "adventure" | "attraction" | "event";
  location?: string;
  place?: string;
  country?: string;
  activities?: any;
  facilities?: any;
  date?: string;
  image_url?: string;
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
  const inputRef = useRef<HTMLDivElement>(null); // Ref for the div containing the Input/Search button

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
        onBlur?.(); // Call original onBlur when clicking outside
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onBlur]); // Added onBlur to dependency array

  // Effect to fetch suggestions when the value changes or the search bar is focused
  useEffect(() => {
    if (showSuggestions) {
      fetchSuggestions();
    }
  }, [value, showSuggestions]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim().toLowerCase();

    try {
      // Fetch all items - we'll filter client-side for activities/facilities
      const [tripsData, eventsData, hotelsData, adventuresData, attractionsData] = await Promise.all([
        supabase.from("trips").select("id, name, location, place, country, activities, date, image_url").eq("approval_status", "approved").eq("type", "trip").limit(50),
        supabase.from("trips").select("id, name, location, place, country, activities, date, image_url").eq("approval_status", "approved").eq("type", "event").limit(50),
        supabase.from("hotels").select("id, name, location, place, country, activities, facilities, image_url").eq("approval_status", "approved").limit(50),
        supabase.from("adventure_places").select("id, name, location, place, country, activities, facilities, image_url").eq("approval_status", "approved").limit(50),
        supabase.from("attractions").select("id, location_name, local_name, country, activities, facilities, photo_urls").eq("approval_status", "approved").limit(50)
      ]);

      let combined: SearchResult[] = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(eventsData.data || []).map((item) => ({ ...item, type: "event" as const })),
        ...(hotelsData.data || []).map((item) => ({ ...item, type: "hotel" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const })),
        ...(attractionsData.data || []).map((item) => ({ 
          ...item, 
          type: "attraction" as const, 
          name: item.location_name,
          location: item.local_name || item.location_name,
          image_url: item.photo_urls?.[0] || undefined
        }))
      ];

      // Filter by search query (including activities and facilities)
      if (queryValue) {
        combined = combined.filter(item => {
          // Check basic fields
          const basicMatch = 
            item.name?.toLowerCase().includes(queryValue) ||
            item.location?.toLowerCase().includes(queryValue) ||
            item.place?.toLowerCase().includes(queryValue) ||
            item.country?.toLowerCase().includes(queryValue);
          
          if (basicMatch) return true;
          
          // Check activities
          if (item.activities) {
            const activitiesMatch = checkJsonArrayMatch(item.activities, queryValue);
            if (activitiesMatch) return true;
          }
          
          // Check facilities
          if (item.facilities) {
            const facilitiesMatch = checkJsonArrayMatch(item.facilities, queryValue);
            if (facilitiesMatch) return true;
          }
          
          return false;
        });
      }

      // Sort alphabetically by name
      combined.sort((a, b) => a.name.localeCompare(b.name));

      setSuggestions(combined.slice(0, 20));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const checkJsonArrayMatch = (data: any, query: string): boolean => {
    if (Array.isArray(data)) {
      return data.some(item => {
        if (typeof item === 'string') {
          return item.toLowerCase().includes(query);
        }
        if (typeof item === 'object' && item !== null) {
          return item.name?.toLowerCase().includes(query);
        }
        return false;
      });
    }
    if (typeof data === 'object' && data !== null) {
      return Object.values(data).some(val => 
        typeof val === 'string' && val.toLowerCase().includes(query)
      );
    }
    return false;
  };

  const getActivitiesText = (activities: any) => {
    const items: string[] = [];
    
    // Get activities only (no facilities)
    if (activities) {
      if (Array.isArray(activities)) {
        activities.forEach(item => {
          const name = typeof item === 'object' && item.name ? item.name : (typeof item === 'string' ? item : null);
          if (name && items.length < 3) items.push(name);
        });
      } else if (typeof activities === "object") {
        Object.values(activities).forEach(val => {
          if (typeof val === 'string' && val && items.length < 3) items.push(val);
        });
      }
    }
    
    return items.slice(0, 3).join(" • ");
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
    // Navigate to detail page based on type
    const typeMap: Record<string, string> = {
      "trip": "trip",
      "event": "event",
      "hotel": "hotel",
      "adventure": "adventure",
      "attraction": "attraction"
    };
    navigate(`/${typeMap[result.type]}/${result.id}`);
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
      case "event":
        return "Event";
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
      case "event":
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
    
  // Calculate the top position for the fixed suggestion box in mobile view
  const getSuggestionTopStyle = (): React.CSSProperties => {
    if (!inputRef.current) return {};
    
    const inputRect = inputRef.current.getBoundingClientRect();
    // For fixed position, top is the distance from the top of the viewport
    const top = inputRect.bottom;
    
    return { top: `${top}px` };
  };

  return (
    <div ref={wrapperRef} className="relative w-full mx-auto">
      <div className="flex items-center gap-2" ref={inputRef}>
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
          <SearchIcon className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Search for trips, events, hotels, campsites, attractions, or countries..."
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
            // The original onBlur is called inside the useEffect for click outside
            // We remove it here to prevent immediate hiding on focus shift within the component.
            // onBlur={onBlur} 
            // Input border focus set to Teal
            className="pl-10 md:pl-12 pr-20 md:pr-24 h-10 md:h-14 text-sm md:text-lg rounded-full border-2 shadow-md"
            style={{ borderColor: showSuggestions ? TEAL_COLOR : undefined }}
          />
          <Button
            onClick={() => {
              saveToHistory(value);
              onSubmit();
            }}
            size="sm"
            // Search button color set to Teal
            style={{ backgroundColor: TEAL_COLOR }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = TEAL_HOVER_COLOR}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = TEAL_COLOR}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-8 md:h-12 px-4 md:px-6 text-white"
          >
            Search
          </Button>
        </div>
      </div>

      {showSuggestions && (
        <div 
            className="absolute left-0 right-0 top-full bg-card border border-border rounded-b-lg shadow-lg max-h-[60vh] md:max-h-96 overflow-y-auto z-[150]"
        >
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
                      // Clear All text color set to Teal
                      className="text-xs hover:underline"
                      style={{ color: TEAL_COLOR }}
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
                    {/* TrendingUp icon color set to Teal */}
                    <TrendingUp className="h-4 w-4" style={{ color: TEAL_COLOR }} />
                    <p className="text-xs font-medium text-muted-foreground">Trending Searches</p>
                  </div>
                  {trendingSearches.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(item.query)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors text-left border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        {/* TrendingUp icon color set to Teal */}
                        <TrendingUp className="h-4 w-4" style={{ color: TEAL_COLOR }} />
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
                const formattedDate = result.date ? new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSuggestionClick(result)}
                    className="w-full px-4 py-3 flex gap-3 hover:bg-accent transition-colors text-left border-b last:border-b-0"
                  >
                    {/* Image with category badge */}
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                      {result.image_url ? (
                        <img 
                          src={result.image_url} 
                          alt={result.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <TypeIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {/* Badge background set to Teal */}
                      <Badge 
                        className="absolute top-1 left-1 text-primary-foreground text-[0.65rem] px-1.5 py-0.5 font-bold"
                        style={{ backgroundColor: TEAL_COLOR }}
                      >
                        {getTypeLabel(result.type).toUpperCase()}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          {/* Type icon color set to Teal */}
                          <TypeIcon className="h-5 w-5 flex-shrink-0" style={{ color: TEAL_COLOR }} />
                          <p className="font-semibold text-base">{result.name}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {result.location && `${result.location}, `}{result.place && `${result.place}, `}{result.country}
                      </p>
                      {formattedDate && (result.type === "trip" || result.type === "event") && (
                        <div 
                          className="flex items-center gap-1 text-xs font-medium" 
                          // Date text color set to Teal
                          style={{ color: TEAL_COLOR }}
                        >
                          <Calendar className="h-3 w-3" />
                          <span>{formattedDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Activities on right side */}
                    {getActivitiesText(result.activities) && (
                      <div className="flex flex-col justify-center gap-1 min-w-[80px] max-w-[100px] text-right">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Activities</p>
                        <p className="text-xs" style={{ color: TEAL_COLOR }}>
                          {getActivitiesText(result.activities)}
                        </p>
                      </div>
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