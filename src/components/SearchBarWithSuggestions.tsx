import React, { useState, useEffect, useRef, useImperativeHandle } from "react";
import { Clock, TrendingUp, Home, Search as SearchIcon, MapPin, Loader2, Sparkles, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSessionId } from "@/lib/sessionManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// ── Design tokens ─────────────────────────────────────────────────────────
// Same field-guide / park-signage system used across the rest of the app:
// deep forest for structure and brand marks/badges, a warm clay for the
// primary "Search" action, and a dry-grass gold for the trending section.
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const CLAY_LIGHT   = "#E0824F";
const CLAY_SOFT    = "#FBEDE6";
const GOLD         = "#B98A2A";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";
const DANGER       = "#9C3B2B";

const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Injects the shared typefaces once, without needing to touch the app's index.html.
const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

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
  // When true, this search bar only searches countries/divisions (from the
  // `countries` / `country_divisions` tables) — no trip/campsite listings,
  // no trending/popular/history. Used on pages that are purely about
  // browsing regions, like ExploreCountries.
  regionsOnly?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: "trip" | "adventure";
  // category distinguishes adventure_places rows (hotel / campsite / accommodation / etc.)
  // so the badge label and icon can be accurate instead of always saying "Campsite".
  category?: string;
  location?: string;
  place?: string;
  country?: string;
  activities?: any;
  image_url?: string;
  matchedActivity?: string;
}

interface RegionCountry { id: string; name: string }
interface RegionDivision { id: string; name: string; country_id: string }

// Handle exposed via ref so a parent page (e.g. Explore.tsx) can open this
// search bar and its suggestions programmatically — for example when the
// person arrives here via the header search icon or the home-page search bar.
export interface SearchBarWithSuggestionsHandle {
  focus: () => void;
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

// ── Where a country/division match should navigate. Matches the convention
// already used by ExploreCountries.tsx's own tile links, so a country or
// division picked from search lands on the same place a tile tap would. ──
const regionCountryPath = (countryName: string) => `/?country=${encodeURIComponent(countryName)}`;
const regionDivisionPath = (countryName: string, divisionId: string) =>
  `/?country=${encodeURIComponent(countryName)}&division=${divisionId}`;


export const SearchBarWithSuggestions = React.forwardRef<SearchBarWithSuggestionsHandle, SearchBarProps>(({ value, onChange, onSubmit, onSuggestionSearch, onFocus, onBlur, onBack, showBackButton = false, regionsOnly = false }, ref) => {
  useInjectFonts();

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
  // Countries / divisions, fetched once and filtered client-side just like
  // the listings cache above.
  const [regionCountries, setRegionCountries] = useState<RegionCountry[]>([]);
  const [regionDivisions, setRegionDivisions] = useState<RegionDivision[]>([]);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lets a parent (Explore.tsx) call searchBarRef.current.focus() to open
  // this search bar and its suggestions programmatically.
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) setSearchHistory(JSON.parse(history));
    // Countries/divisions are cheap and useful everywhere, so always fetch.
    fetchRegions();
    // Trip/campsite-related data is skipped entirely in regionsOnly mode —
    // this bar only ever searches countries and divisions there.
    if (!regionsOnly) {
      fetchTrendingSearches();
      fetchMostPopular();
      fetchLocationSuggestions();
      // Pre-fetch and cache all listings for instant partial-match suggestions
      prefetchAllListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRegions = async () => {
    try {
      const [c, d] = await Promise.all([
        supabase.from("countries").select("id, name"),
        supabase.from("country_divisions").select("id, name, country_id"),
      ]);
      setRegionCountries(c.data || []);
      setRegionDivisions(d.data || []);
    } catch (error) {
      console.error("Error fetching countries/divisions:", error);
    }
  };

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
          .select("id, name, location, place, country, activities, category")
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
        supabase.from("adventure_places").select("id, name, location, place, country, category").eq("approval_status", "approved").eq("is_hidden", false).order("created_at", { ascending: false }).limit(4)
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

  // Instant client-side filter on every keystroke using the cache.
  // Skipped entirely in regionsOnly mode — there are no listings to filter.
  useEffect(() => {
    if (regionsOnly) {
      setSuggestions([]);
      setIsSearching(false);
      setHasSearched(Boolean(value.trim()));
      return;
    }

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
  }, [value, showSuggestions, allListingsCache, regionsOnly]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim().toLowerCase();
    try {
      const [tripsData, adventuresData] = await Promise.all([
        supabase.from("trips").select("id, name, location, place, country, activities").eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").limit(20),
        supabase.from("adventure_places").select("id, name, location, place, country, activities, category").eq("approval_status", "approved").eq("is_hidden", false).limit(20)
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

  // Labels now reflect the actual listing category rather than lumping every
  // adventure_places row under "Campsite" — AirBnb / hotel listings get their
  // own badge text so search results read correctly.
  const getTypeLabel = (type: string, category?: string) => {
    if (type === "trip") return "Trip";
    if (type === "adventure") {
      const categoryLabels: Record<string, string> = {
        campsite: "Campsite",
        park: "Park",
        attraction: "Attraction",
      };
      return categoryLabels[category ?? ""] || "Campsite";
    }
    return type;
  };

  // ── Country / division matches — replaces the old hardcoded Kenya-county
  // list with live data from the countries/country_divisions tables, so this
  // now works for every country that's been added via the admin page,
  // not just Kenya. ──
  const qLower = value.trim().toLowerCase();
  const matchedCountries = qLower ? regionCountries.filter((c) => c.name.toLowerCase().includes(qLower)) : [];
  const matchedDivisions = qLower ? regionDivisions.filter((d) => d.name.toLowerCase().includes(qLower)) : [];

  const handleRegionCountryClick = (country: RegionCountry) => {
    setShowSuggestions(false);
    navigate(regionCountryPath(country.name));
  };
  const handleRegionDivisionClick = (division: RegionDivision) => {
    const countryName = regionCountries.find((c) => c.id === division.country_id)?.name || "";
    setShowSuggestions(false);
    navigate(regionDivisionPath(countryName, division.id));
  };

  const noResults = regionsOnly
    ? Boolean(qLower) && matchedCountries.length === 0 && matchedDivisions.length === 0
    : !isSearching && hasSearched && suggestions.length === 0 && matchedCountries.length === 0 && matchedDivisions.length === 0;

  return (
    <div className="w-full" style={{ fontFamily: FONT_BODY }}>
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
              <SearchIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 z-10 transition-colors"
                style={{ color: INK_SOFT }}
              />
              <Input
                ref={inputRef}
                type="text"
                placeholder={regionsOnly ? "Search a country or division" : "Where to next? Search trips, adventures, campsites..."}
                value={value}
                onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyPress}
                onFocus={() => { setShowSuggestions(true); onFocus?.(); }}
                className="pl-8 pr-20 h-6 md:h-10 text-xs md:text-sm rounded-full shadow-md bg-white placeholder:font-medium transition-all"
                style={{ border: `2px solid ${HAIRLINE}`, color: INK }}
              />
              <Button
                onClick={() => { saveToHistory(value); onSubmit(); setShowSuggestions(false); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-4 md:h-7 px-2.5 md:px-3.5 text-[8px] md:text-[10px] font-semibold text-white shadow-lg transition-transform active:scale-95 border-none hover:opacity-95"
                style={{ background: `linear-gradient(135deg, ${CLAY_LIGHT}, ${CLAY})` }}
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
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-lg shadow-xl max-h-[70vh] md:max-h-[500px] overflow-y-auto z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ position: 'absolute', border: `1px solid ${HAIRLINE}` }}
            >
              {/* History / Trending / Most Popular (shown when input is empty) — skipped entirely in regionsOnly mode */}
              {!regionsOnly && !value.trim() && (
                <div className="p-1.5 min-h-[60px]">
                  {/* Popular Locations */}
                  {locationSuggestions.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <MapPin className="h-3 w-3" style={{ color: FOREST }} />
                        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Popular locations</p>
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {locationSuggestions.map((loc) => (
                          <Badge
                            key={loc.location}
                            onClick={() => { onChange(loc.location); setShowSuggestions(false); onSubmit(); }}
                            className="cursor-pointer py-0.5 px-2 rounded-md text-[10px] font-semibold transition-colors border"
                            style={{ background: FOREST_SOFT, color: FOREST, borderColor: `${FOREST}25` }}
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
                        <Sparkles className="h-3 w-3" style={{ color: FOREST }} />
                        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Most popular</p>
                      </div>
                      <div className="space-y-0.5">
                        {mostPopular.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSuggestionClick(item)}
                            className="w-full p-1.5 flex gap-2 hover:bg-[#F4F6F2] transition-all group text-left rounded-md"
                          >
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                              <h4 className="font-semibold tracking-tight text-xs truncate" style={{ color: INK }}>{formatTitle(item.name)}</h4>
                              <div className="flex items-center gap-1" style={{ color: INK_SOFT }}>
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="text-[10px] font-medium truncate">{formatTitle(item.location || item.country)}</span>
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
                          <Clock className="h-3 w-3" style={{ color: FOREST }} />
                          <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Recent</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); clearHistory(); }} className="text-[10px] font-semibold hover:underline" style={{ color: DANGER }}>Clear</button>
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {searchHistory.map((item, i) => (
                          <Badge 
                            key={i} 
                            onClick={() => { onChange(item); saveToHistory(item); onSubmit(); setShowSuggestions(false); }} 
                            className="cursor-pointer py-0.5 px-2 rounded-md text-[10px] font-medium transition-colors border"
                            style={{ background: CANVAS, color: INK_SOFT, borderColor: HAIRLINE }}
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
                        <TrendingUp className="h-3 w-3" style={{ color: GOLD }} />
                        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Trending destinations</p>
                      </div>
                      {trendingSearches.slice(0, 5).map((item, index) => (
                        <button 
                          key={index} 
                          onClick={() => { onChange(item.query); saveToHistory(item.query); onSubmit(); setShowSuggestions(false); }} 
                          className="w-full px-2 py-2 flex items-center justify-between hover:bg-[#F4F6F2] transition-colors group text-left rounded-md"
                        >
                          <span className="text-xs font-semibold tracking-tight transition-colors" style={{ color: INK }}>{formatTitle(item.query)}</span>
                          <span className="text-[10px] font-medium tracking-tight" style={{ color: "#A7B2AB" }}>{item.search_count} explores</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Result Suggestions (shown when typing) */}
              {value.trim() && (
                <div className="p-1.5">
                  {/* Loading State — only shown during fallback network fetch, never in regionsOnly mode */}
                  {!regionsOnly && isSearching && (
                    <div className="p-5 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: FOREST }} />
                      <span className="text-[11px] font-medium" style={{ color: INK_SOFT }}>Searching…</span>
                    </div>
                  )}

                  {/* Country / Division Matches — DB-driven, works for every
                      country added via the admin page, not just Kenya. */}
                  {(matchedCountries.length > 0 || matchedDivisions.length > 0) && (
                    <div className="mb-1.5">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <Map className="h-3 w-3" style={{ color: FOREST }} />
                        <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Countries &amp; divisions</p>
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {matchedCountries.slice(0, 6).map((c) => (
                          <Badge
                            key={c.id}
                            onClick={() => handleRegionCountryClick(c)}
                            className="cursor-pointer py-0.5 px-2 rounded-md text-[10px] font-semibold transition-colors border"
                            style={{ background: FOREST_SOFT, color: FOREST, borderColor: `${FOREST}25` }}
                          >
                            {formatTitle(c.name)}
                          </Badge>
                        ))}
                        {matchedDivisions.slice(0, 6).map((d) => (
                          <Badge
                            key={d.id}
                            onClick={() => handleRegionDivisionClick(d)}
                            className="cursor-pointer py-0.5 px-2 rounded-md text-[10px] font-semibold transition-colors border"
                            style={{ background: CLAY_SOFT, color: CLAY, borderColor: `${CLAY}30` }}
                          >
                            {formatTitle(d.name)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Results — trip/campsite listings, skipped entirely in regionsOnly mode */}
                  {!regionsOnly && !isSearching && suggestions.length > 0 && (
                    <>
                      <p className="px-2 py-1.5 text-[10px] font-medium" style={{ color: INK_SOFT }}>Top matches</p>
                      {suggestions.slice(0, 5).map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSuggestionClick(result)}
                          className="w-full p-1.5 flex gap-2 hover:bg-[#F4F6F2] transition-all group text-left rounded-md"
                        >
                          <div className="flex-1 flex flex-col justify-center min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-sm" style={{ background: FOREST_DEEP }}>
                                {getTypeLabel(result.type, result.category)}
                              </span>
                              {result.matchedActivity && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-sm border" style={{ background: CLAY_SOFT, color: CLAY, borderColor: `${CLAY}30` }}>
                                  🎯 {formatTitle(result.matchedActivity)}
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold tracking-tight text-xs truncate" style={{ color: INK }}>{formatTitle(result.name)}</h4>
                            <div className="flex items-center gap-1 mt-0.5 transition-colors" style={{ color: INK_SOFT }}>
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              <span className="text-[10px] font-medium">
                                {formatTitle([result.location, result.place, result.country].filter(Boolean).join(" · "))}
                              </span>
                            </div>
                            {getActivitiesText(result.activities) && !result.matchedActivity && (
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: "#A7B2AB" }}>
                                {formatTitle(getActivitiesText(result.activities))}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Not Available */}
                  {noResults && (
                    <div className="p-5 text-center">
                      <p className="text-[11px] font-medium mb-1.5" style={{ color: INK_SOFT }}>Not available</p>
                      <p className="text-[10px]" style={{ color: "#A7B2AB" }}>No results found for "{value}"</p>
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