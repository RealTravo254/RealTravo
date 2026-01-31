import React, { useState, useRef, useEffect } from "react";
import { Search, MapPin, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const COLORS = {
  TEAL: "#008080",
};

interface LocationResult {
  id: string;
  name: string;
  location: string;
  country: string;
}

export const FilterBar = () => {
  // 1. DATE STATE: Initialized with today's date
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  
  // 2. LOCATION STATE
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Close dropdown when clicking outside the entire bar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. LOCATION FETCH LOGIC (Supabase)
  useEffect(() => {
    const fetchLocations = async () => {
      if (!locationQuery.trim()) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from("trips")
          .select("id, name, location, place, country")
          .eq("approval_status", "approved")
          .or(`location.ilike.%${locationQuery}%,place.ilike.%${locationQuery}%,country.ilike.%${locationQuery}%`)
          .limit(6);

        if (!error && data) {
          setSuggestions(data as LocationResult[]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchLocations, 300);
    return () => clearTimeout(debounceTimer);
  }, [locationQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4" ref={containerRef}>
      <div className="relative flex flex-row items-center bg-white border border-slate-100 rounded-2xl shadow-xl h-14 md:h-16">
        
        {/* WHERE SECTION */}
        <div className="flex flex-col flex-1 px-4 md:px-6 py-1 relative">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> Where
          </label>
          <input 
            type="text" 
            placeholder="Destinations" 
            value={locationQuery}
            onFocus={() => setShowSuggestions(true)} // Opens immediately
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setShowSuggestions(true);
            }}
            className="bg-transparent border-none p-0 text-sm md:text-base focus:ring-0 placeholder:text-slate-300 font-bold outline-none text-slate-700 w-full"
          />

          {/* SUGGESTIONS DROPDOWN */}
          {showSuggestions && (
            <div className="absolute top-[115%] left-0 w-full md:w-[320px] bg-white rounded-[24px] shadow-2xl border border-slate-50 z-[100] py-3 animate-in fade-in slide-in-from-top-1">
              <p className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {isSearching ? "Searching..." : locationQuery ? "Top Matches" : "Start typing..."}
              </p>
              
              <div className="flex flex-col max-h-[280px] overflow-y-auto">
                {isSearching && (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>
                )}
                
                {!isSearching && suggestions.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => {
                      setLocationQuery(dest.location || dest.name);
                      setShowSuggestions(false);
                    }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left group"
                  >
                    <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-teal-50 transition-colors">
                      <MapPin className="h-4 w-4 text-slate-500 group-hover:text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{dest.location || dest.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{dest.country}</p>
                    </div>
                  </button>
                ))}

                {!isSearching && locationQuery && suggestions.length === 0 && (
                   <p className="px-5 py-4 text-xs font-bold text-slate-400 italic text-center">No matches found</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* FROM SECTION - Shows current date by default */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> From
              </span>
              <span className="text-sm font-bold text-slate-700">
                {dateFrom ? format(dateFrom, "MMM dd") : format(today, "MMM dd")}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              disabled={(date) => date < today}
              defaultMonth={dateFrom || today}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* TO SECTION - Shows current date by default */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> To
              </span>
              <span className="text-sm font-bold text-slate-700">
                {dateTo ? format(dateTo, "MMM dd") : format(today, "MMM dd")}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              disabled={(date) => (dateFrom ? date < dateFrom : date < today)}
              defaultMonth={dateTo || dateFrom || today}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* SEARCH/APPLY BUTTON */}
        <button
          className="flex items-center justify-center text-white h-full px-8 rounded-r-2xl transition-all hover:brightness-110 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
        >
          <Search className="w-5 h-5 stroke-[3px]" />
        </button>
      </div>
    </div>
  );
};