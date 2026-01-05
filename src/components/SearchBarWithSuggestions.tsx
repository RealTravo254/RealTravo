import { useState, useEffect, useRef } from "react";
import { Clock, X, TrendingUp, Plane, Hotel, Tent, Landmark, ArrowLeft, Calendar, Search as SearchIcon, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSessionId } from "@/lib/sessionManager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  SOFT_GRAY: "#F8F9FA"
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

  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) setSearchHistory(JSON.parse(history));
    fetchTrendingSearches();
  }, []);

  const fetchTrendingSearches = async () => {
    try {
      const { data, error } = await supabase.rpc('get_trending_searches', { limit_count: 10 });
      if (!error && data) setTrendingSearches(data);
    } catch (error) {
      console.error("Error fetching trending searches:", error);
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

  useEffect(() => {
    if (showSuggestions && value.trim()) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [value, showSuggestions]);

  const fetchSuggestions = async () => {
    const queryValue = value.trim().toLowerCase();
    try {
      const [tripsData, eventsData, hotelsData, adventuresData] = await Promise.all([
        supabase.from("trips").select("id, name, location, place, country, activities, date, image_url").eq("approval_status", "approved").eq("type", "trip").limit(30),
        supabase.from("trips").select("id, name, location, place, country, activities, date, image_url").eq("approval_status", "approved").eq("type", "event").limit(30),
        supabase.from("hotels").select("id, name, location, place, country, activities, facilities, image_url").eq("approval_status", "approved").limit(30),
        supabase.from("adventure_places").select("id, name, location, place, country, activities, facilities, image_url").eq("approval_status", "approved").limit(30)
      ]);

      let combined: SearchResult[] = [
        ...(tripsData.data || []).map((item) => ({ ...item, type: "trip" as const })),
        ...(eventsData.data || []).map((item) => ({ ...item, type: "event" as const })),
        ...(hotelsData.data || []).map((item) => ({ ...item, type: "hotel" as const })),
        ...(adventuresData.data || []).map((item) => ({ ...item, type: "adventure" as const }))
      ];

      if (queryValue) {
        combined = combined.filter(item => 
          item.name?.toLowerCase().includes(queryValue) ||
          item.location?.toLowerCase().includes(queryValue) ||
          item.place?.toLowerCase().includes(queryValue) ||
          item.country?.toLowerCase().includes(queryValue) ||
          checkJsonArrayMatch(item.activities, queryValue) ||
          checkJsonArrayMatch(item.facilities, queryValue)
        );
      }
      combined.sort((a, b) => a.name.localeCompare(b.name));
      setSuggestions(combined.slice(0, 15));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const checkJsonArrayMatch = (data: any, query: string): boolean => {
    if (Array.isArray(data)) {
      return data.some(item => (typeof item === 'string' ? item : item?.name)?.toLowerCase().includes(query));
    }
    return false;
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
    const labels: Record<string, string> = { trip: "Trip", event: "Experience", hotel: "Stay", adventure: "Campsite", attraction: "Sights" };
    return labels[type] || type;
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-4xl mx-auto" style={{ isolation: 'isolate' }}>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-white shadow-sm border border-slate-100 hover:text-[#008080]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="relative flex-1 group">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 z-10 group-focus-within:text-[#008080] transition-colors" />
          <Input
            type="text"
            placeholder="Where to next? Search countries, experiences, stays..."
            value={value}
            onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
            onKeyDown={handleKeyPress}
            onFocus={() => { setShowSuggestions(true); onFocus?.(); }}
            className="pl-14 pr-32 h-14 md:h-16 text-sm md:text-base rounded-full border-none shadow-xl bg-white focus-visible:ring-2 focus-visible:ring-[#008080] placeholder:text-slate-400 placeholder:font-medium transition-all"
          />
          <Button
            onClick={() => { saveToHistory(value); onSubmit(); setShowSuggestions(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-10 md:h-12 px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 border-none"
            style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
          >
            Search
          </Button>
        </div>
      </div>

      {showSuggestions && (
        <div 
          className="absolute left-0 right-0 top-full mt-3 bg-white border border-slate-100 rounded-[32px] shadow-2xl max-h-[70vh] md:max-h-[500px] overflow-y-auto z-[999] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* History / Trending Section (Shown when input is empty) */}
          {!value.trim() && (
            <div className="p-2 min-h-[100px]">
              {searchHistory.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#008080]" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recent</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); clearHistory(); }} className="text-[10px] font-black uppercase text-[#FF7F50] hover:underline">Clear</button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4">
                    {searchHistory.map((item, i) => (
                      <Badge 
                        key={i} 
                        onClick={() => { onChange(item); saveToHistory(item); onSubmit(); setShowSuggestions(false); }} 
                        className="cursor-pointer bg-slate-50 hover:bg-[#008080]/10 text-slate-600 border border-slate-100 py-2 px-4 rounded-xl text-xs font-bold transition-colors"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {trendingSearches.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 px-5 py-3">
                    <TrendingUp className="h-4 w-4 text-[#FF7F50]" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Trending Destinations</p>
                  </div>
                  {trendingSearches.map((item, index) => (
                    <button 
                      key={index} 
                      onClick={() => { onChange(item.query); saveToHistory(item.query); onSubmit(); setShowSuggestions(false); }} 
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group text-left rounded-[20px]"
                    >
                      <span className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-[#008080]">{item.query}</span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{item.search_count} explores</span>
                    </button>
                  ))}
                </div>
              ) : (
                !searchHistory.length && (
                  <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                    Start typing to explore...
                  </div>
                )
              )}
            </div>
          )}

          {/* Result Suggestions (Shown when typing) */}
          {value.trim() && (
            <div className="p-2">
              {suggestions.length > 0 ? (
                <>
                  <p className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Top Matches</p>
                  {suggestions.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSuggestionClick(result)}
                      className="w-full p-3 flex gap-4 hover:bg-slate-50 transition-all group text-left rounded-[24px]"
                    >
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
                        <img src={result.image_url || "/placeholder.svg"} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                      </div>

                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ background: COLORS.TEAL }}>
                            {getTypeLabel(result.type)}
                          </span>
                          {result.date && (
                            <span className="text-[9px] font-black text-[#FF7F50] uppercase tracking-widest">
                              • {new Date(result.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm truncate">{result.name}</h4>
                        <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#008080] transition-colors">
                          <MapPin className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase truncate">
                            {result.location || result.country}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                  No matches found for "{value}"
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};