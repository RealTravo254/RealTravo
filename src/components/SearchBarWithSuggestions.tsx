import React, { useState, useEffect, useRef } from "react";
import { Clock, TrendingUp, Home, Search as SearchIcon, MapPin, Loader2, Sparkles, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSessionId } from "@/lib/sessionManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { KENYA_COUNTIES } from "@/lib/kenyaCounties";


interface SearchBarProps { 
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestionSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  showEventCategories?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: "trip" | "adventure";
  location?: string;
  place?: string;
  country?: string;
  activities?: any;
  image_url?: string;
  matchedActivity?: string;
}

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY_ITEMS = 10;

interface TrendingSearch {
  query: string;
  search_count: number;
}

interface LocationSuggestion {
  location: string;
  count: number;
  type: string;
}

// Small words that should stay lowercase in a title, UNLESS they are the first word.
const MINOR_WORDS = new Set([
  "a", "an", "the",
  "of", "on", "in", "at", "by", "for", "to", "from", "with", "as",
  "and", "or", "nor", "but"
]);

// Formats a name/title so only the first letter of each major word is capitalized.
// Articles/prepositions/conjunctions ("of", "on", "in", "the", "and", etc.) stay
// lowercase unless they are the very first word of the string.
const formatTitle = (str?: string | null): string => {
  if (!str) return "";
  return str
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (index !== 0 && MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};


export const SearchBarWithSuggestions = React.forwardRef<HTMLDivElement, SearchBarProps>(({ value, onChange, onSubmit, onSuggestionSearch, onFocus, onBlur, onBack, showBackButton = false }, _ref) => {
  const { user } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [mostPopular, setMostPopular] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<TrendingSearch[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  // Cache all listings so we can filter client-side instantly on every keystroke
  const [allListingsCache, setAllListingsCache] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) setSearchHistory(JSON.parse(history));
    fetchTrendingSearches();
    fetchMostPopular();
    fetchLocationSuggestions();
    // Pre-fetch and cache all listings for instant partial-match suggestions
    prefetchAllListings();
  }, []);

  // Pre-fetch all listings once and cache them for instant client-side filtering
  const prefetchAllListings = async () => {
    try {
      const [tripsData, adventuresData] = await Promise.all([
        supabase
          .from("trips")
          .select("id, name, location, place, country, activities")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .eq("type", "trip")
          .limit(100),
        supabase
          .from("adventure_places")
          .select("id, name, location, place, country, activities")
          .eq("approval_status", "approved")
          .eq("is_hidden", false)
          .limit(100),
      ]);

      const combined: SearchResult[] = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const })),
      ];
      setAllListingsCache(combined);
    } catch (error) {
      console.error("Error pre-fetching listings:", error);
    }
  };

  const fetchTrendingSearches = async () => {
    try {
      const { data, error } = await supabase.rpc('get_trending_searches', { limit_count: 10 });
      if (!error && data) setTrendingSearches(data);
    } catch (error) {
      console.error("Error fetching trending searches:", error);
    }
  };

  const fetchLocationSuggestions = async () => {
    try {
      const [tripsLoc, adventureLoc] = await Promise.all([
        supabase.from("trips").select("location").eq("approval_status", "approved").eq("is_hidden", false).limit(50),
        supabase.from("adventure_places").select("location").eq("approval_status", "approved").eq("is_hidden", false).limit(50),
      ]);
      const locationMap: Record<string, { count: number; type: string }> = {};
      const addLocations = (data: any[] | null, type: string) => {
        (data || []).forEach((item: any) => {
          if (item.location) {
            const loc = item.location.trim();
            const existing = locationMap[loc];
            locationMap[loc] = { count: (existing?.count || 0) + 1, type: existing?.type || type };
          }
        });
      };
      addLocations(tripsLoc.data, "trip");
      addLocations(adventureLoc.data, "adventure");
      const sorted = Object.entries(locationMap)
        .map(([location, info]) => ({ location, count: info.count, type: info.type }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      setLocationSuggestions(sorted);
    } catch (error) {
      console.error("Error fetching location suggestions:", error);
    }
  };

  const fetchMostPopular = async () => {
    try {
      const [tripsData, adventuresData] = await Promise.all([
        supabase.from("trips").select("id, name, location, place, country, type").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").order("created_at", { ascending: false }).limit(4),
        supabase.from("adventure_places").select("id, name, location, place, country").eq("approval_status", "approved").eq("is_hidden", false).order("created_at", { ascending: false }).limit(4)
      ]);

      const popular: SearchResult[] = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const }))
      ];
      setMostPopular(popular.slice(0, 8));
    } catch (error) {
      console.error("Error fetching most popular:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onBlur]);

  // Instant client-side filter on every keystroke using the cache
  useEffect(() => {
    if (!showSuggestions || !value.trim()) {
      setSuggestions([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    const queryValue = value.trim().toLowerCase();

    // If cache is available, filter instantly (no loading state, no debounce needed)
    if (allListingsCache.length > 0) {
      const filtered = allListingsCache
        .map(item => {
          const activityMatch = findMatchingActivity(item.activities, queryValue);
          return { ...item, matchedActivity: activityMatch };
        })
        .filter(item =>
          item.name?.toLowerCase().includes(queryValue) ||
          item.location?.toLowerCase().includes(queryValue) ||
          item.place?.toLowerCase().includes(queryValue) ||
          item.country?.toLowerCase().includes(queryValue) ||
          item.matchedActivity
        )
        .sort((a, b) => {
          // Prioritise names that START with the query
          const aStarts = a.name?.toLowerCase().startsWith(queryValue) ? 0 : 1;
          const bStarts = b.name?.toLowerCase().startsWith(queryValue) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name);
        });

      setSuggestions(filtered.slice(0, 10));
      setHasSearched(true);
      setIsSearching(false);
      return;
    }

    // Fallback: debounced fetch if cache isn't ready yet
    setIsSearching(true);
    setHasSearched(false);
    const debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, showSuggestions, allListingsCache]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim().toLowerCase();
    try {
      const [tripsData, adventuresData] = await Promise.all([
        supabase.from("trips").select("id, name, location, place, country, activities").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").limit(20),
        supabase.from("adventure_places").select("id, name, location, place, country, activities").eq("approval_status", "approved").eq("is_hidden", false).limit(20)
      ]);

      let combined: SearchResult[] = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const }))
      ];

      if (queryValue) {
        combined = combined
          .map(item => {
            const activityMatch = findMatchingActivity(item.activities, queryValue);
            return { ...item, matchedActivity: activityMatch };
          })
          .filter(item => 
            item.name?.toLowerCase().includes(queryValue) ||
            item.location?.toLowerCase().includes(queryValue) ||
            item.place?.toLowerCase().includes(queryValue) ||
            item.country?.toLowerCase().includes(queryValue) ||
            item.matchedActivity
          );
      }
      combined.sort((a, b) => a.name.localeCompare(b.name));
      setSuggestions(combined.slice(0, 10));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const findMatchingActivity = (activities: any, query: string): string | undefined => {
    if (!Array.isArray(activities)) return undefined;
    for (const item of activities) {
      const name = typeof item === 'object' ? item.name : item;
      if (name && name.toLowerCase().includes(query)) return name;
    }
    return undefined;
  };

  const getActivitiesText = (activities: any) => {
    const items: string[] = [];
    if (Array.isArray(activities)) {
      activities.forEach(item => {
        const name = typeof item === 'object' ? item.name : item;
        if (name && items.length < 2) items.push(name);
      });
    }
    return items.join(" • ");
  };

  const saveToHistory = async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const updatedHistory = [trimmedQuery, ...searchHistory.filter(item => item !== trimmedQuery)].slice(0, MAX_HISTORY_ITEMS);
    setSearchHistory(updatedHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
    try {
      await supabase.from('search_queries').insert({ query: trimmedQuery, user_id: user?.id || null, session_id: user ? null : getSessionId() });
      fetchTrendingSearches();
    } catch (e) {}
  };

  const clearHistory = () => { setSearchHistory([]); localStorage.removeItem(SEARCH_HISTORY_KEY); };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setShowSuggestions(false); saveToHistory(value); onSubmit(); }
  };

  const handleSuggestionClick = (result: SearchResult) => {
    setShowSuggestions(false);
    saveToHistory(result.name);
    navigate(`/${result.type}/${result.id}`);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = { trip: "Trip", adventure: "Campsite" };
    return labels[type] || type;
  };

  return (
    <div className="w-full">
      <div className="w-full px-3 md:container md:mx-auto md:px-6 lg:px-8">
        {/* ── Search bar: height reduced ~40% (h-10/h-16 → h-6/h-10) so it takes
            up noticeably less vertical space on both mobile and desktop. ── */}
        <div ref={wrapperRef} className="relative w-full max-w-4xl mx-auto" style={{ isolation: 'isolate' }}>
          <div className="flex items-center gap-2">

            {/* ── Home button — visible on ALL screen sizes when showBackButton is true ── */}
            {showBackButton && (
              <button
                onClick={() => navigate("/")}
                aria-label="Go to Home"
                className="shrink-0 h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/35 text-white transition-all active:scale-95"
              >
                <Home className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            )}

            <div className="relative flex-1 group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground z-10 group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder="Where to next? Search trips, adventures, campsites..."
                value={value}
                onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyPress}
                onFocus={() => { setShowSuggestions(true); onFocus?.(); }}
                className="pl-8 pr-20 h-6 md:h-10 text-xs md:text-sm rounded-full border-2 border-border shadow-md bg-card text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground placeholder:font-medium transition-all"
              />
              <Button
                onClick={() => { saveToHistory(value); onSubmit(); setShowSuggestions(false); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-4 md:h-7 px-2.5 md:px-3.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary-dark text-primary-foreground shadow-lg transition-transform active:scale-95 border-none"
              >
                Search
              </Button>
            </div>
          </div>

          {showSuggestions && (
            <div 
              // onMouseDown prevents the input's onBlur from firing when clicking
              // inside the dropdown, so suggestions stay open on click
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-xl max-h-[70vh] md:max-h-[500px] overflow-y-auto z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ position: 'absolute' }}
            >
              {/* History / Trending / Most Popular (shown when input is empty) */}
              {!value.trim() && (
                <div className="p-1.5 min-h-[60px]">
                  {/* Popular Locations */}
                  {locationSuggestions.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <MapPin className="h-3 w-3 text-primary" />
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Popular Locations</p>
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {locationSuggestions.map((loc) => (
                          <Badge
                            key={loc.location}
                            onClick={() => { onChange(loc.location); setShowSuggestions(false); onSubmit(); }}
                            className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-0.5 px-2 rounded-md text-[9px] font-bold transition-colors"
                          >
                            {formatTitle(loc.location)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Most Popular */}
                  {mostPopular.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Most Popular</p>
                      </div>
                      <div className="space-y-0.5">
                        {mostPopular.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSuggestionClick(item)}
                            className="w-full p-1.5 flex gap-2 hover:bg-muted transition-all group text-left rounded-md"
                          >
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                              <h4 className="font-bold text-foreground tracking-tight text-xs truncate">{formatTitle(item.name)}</h4>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="text-[9px] font-semibold truncate">{formatTitle(item.location || item.country)}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent History */}
                  {searchHistory.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-primary" />
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Recent</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); clearHistory(); }} className="text-[9px] font-black uppercase text-destructive hover:underline">Clear</button>
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {searchHistory.map((item, i) => (
                          <Badge 
                            key={i} 
                            onClick={() => { onChange(item); saveToHistory(item); onSubmit(); setShowSuggestions(false); }} 
                            className="cursor-pointer bg-muted hover:bg-primary/10 text-muted-foreground border border-border py-0.5 px-2 rounded-md text-[10px] font-semibold transition-colors"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Destinations */}
                  {trendingSearches.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <TrendingUp className="h-3 w-3 text-secondary" />
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Trending Destinations</p>
                      </div>
                      {trendingSearches.slice(0, 5).map((item, index) => (
                        <button 
                          key={index} 
                          onClick={() => { onChange(item.query); saveToHistory(item.query); onSubmit(); setShowSuggestions(false); }} 
                          className="w-full px-2 py-2 flex items-center justify-between hover:bg-muted transition-colors group text-left rounded-md"
                        >
                          <span className="text-xs font-bold text-foreground tracking-tight group-hover:text-primary">{formatTitle(item.query)}</span>
                          <span className="text-[9px] font-semibold text-muted-foreground/50 tracking-tight">{item.search_count} explores</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Result Suggestions (shown when typing) */}
              {value.trim() && (
                <div className="p-1.5">
                  {/* Loading State — only shown during fallback network fetch */}
                  {isSearching && (
                    <div className="p-5 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">Searching...</span>
                    </div>
                  )}

                  {/* County Matches */}
                  {(() => {
                    const q = value.trim().toLowerCase();
                    const matchedCounties = q ? KENYA_COUNTIES.filter(c => c.toLowerCase().includes(q)) : [];
                    if (matchedCounties.length > 0) {
                      return (
                        <div className="mb-1.5">
                          <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <Map className="h-3 w-3 text-primary" />
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Counties</p>
                          </div>
                          <div className="flex flex-wrap gap-1 px-2">
                            {matchedCounties.slice(0, 6).map(county => (
                              <Badge
                                key={county}
                                onClick={() => { setShowSuggestions(false); navigate(`/county/${encodeURIComponent(county)}`); }}
                                className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-0.5 px-2 rounded-md text-[9px] font-bold transition-colors"
                              >
                                {formatTitle(county)} County
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Results */}
                  {!isSearching && suggestions.length > 0 && (
                    <>
                      <p className="px-2 py-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">Top Matches</p>
                      {suggestions.slice(0, 5).map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSuggestionClick(result)}
                          className="w-full p-1.5 flex gap-2 hover:bg-muted transition-all group text-left rounded-md"
                        >
                          <div className="flex-1 flex flex-col justify-center min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-[8px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                                {getTypeLabel(result.type)}
                              </span>
                              {result.matchedActivity && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase bg-accent/15 text-accent border border-accent/20">
                                  🎯 {formatTitle(result.matchedActivity)}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-foreground tracking-tight text-xs truncate">{formatTitle(result.name)}</h4>
                            <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors mt-0.5">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="text-[9px] font-semibold">
                                {formatTitle([result.location, result.place, result.country].filter(Boolean).join(" · "))}
                              </span>
                            </div>
                            {getActivitiesText(result.activities) && !result.matchedActivity && (
                              <p className="text-[9px] text-muted-foreground/70 mt-0.5 truncate">
                                {formatTitle(getActivitiesText(result.activities))}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Not Available */}
                  {!isSearching && hasSearched && suggestions.length === 0 && KENYA_COUNTIES.filter(c => c.toLowerCase().includes(value.trim().toLowerCase())).length === 0 && (
                    <div className="p-5 text-center">
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest mb-1.5">Not Available</p>
                      <p className="text-muted-foreground/50 text-[9px]">No results found for "{value}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
SearchBarWithSuggestions.displayName = "SearchBarWithSuggestions";