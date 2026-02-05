import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, Calendar as CalendarIcon, Loader2, X } from "lucide-react";
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

export interface FilterValues {
  location?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface FilterBarProps {
  type?: "trips-events" | "hotels" | "adventure" | "accommodation";
  onApplyFilters?: (filters: FilterValues) => void;
}

export const FilterBar = ({ type = "trips-events", onApplyFilters }: FilterBarProps) => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!locationQuery.trim()) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        let allSuggestions: LocationResult[] = [];
        
        // Dynamic table selection based on type
        const tableMap: Record<string, string> = {
          "trips-events": "trips",
          "hotels": "hotels",
          "accommodation": "hotels",
          "adventure": "adventure_places"
        };

        let query = supabase
          .from(tableMap[type])
          .select("id, name, location, place, country")
          .eq("approval_status", "approved");

        if (type === "accommodation") {
          query = query.eq("establishment_type", "accommodation_only");
        }

        const { data, error } = await query
          .or(`name.ilike.%${locationQuery}%,location.ilike.%${locationQuery}%,place.ilike.%${locationQuery}%,country.ilike.%${locationQuery}%`)
          .limit(10);

        if (!error && data) {
          allSuggestions = data.map(item => ({
            id: item.id,
            name: item.name,
            location: item.location || item.place,
            country: item.country
          }));
        }

        const uniqueLocations = allSuggestions.reduce((acc, curr) => {
          const key = `${curr.location}-${curr.country}`;
          if (!acc.find(item => `${item.location}-${item.country}` === key)) {
            acc.push(curr);
          }
          return acc;
        }, [] as LocationResult[]);

        setSuggestions(uniqueLocations);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchLocations, 300);
    return () => clearTimeout(debounceTimer);
  }, [locationQuery, type]);

  const handleApplyFilters = useCallback(() => {
    if (onApplyFilters) {
      onApplyFilters({
        location: locationQuery || undefined,
        dateFrom: dateFrom,
        dateTo: dateTo
      });
    }
  }, [locationQuery, dateFrom, dateTo, onApplyFilters]);

  useEffect(() => {
    if (dateFrom || dateTo) {
      handleApplyFilters();
    }
  }, [dateFrom, dateTo, handleApplyFilters]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4" ref={containerRef}>
      <div className="relative flex flex-row items-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl h-14 md:h-16">
        
        {/* WHERE SECTION */}
        <div className="flex flex-col flex-1 px-4 md:px-6 py-1 relative">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> Where
          </label>
          <div className="flex items-center">
            <input 
              type="text" 
              placeholder="Destinations" 
              value={locationQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setShowSuggestions(true);
              }}
              className="bg-transparent border-none p-0 text-sm md:text-base focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-500 font-bold outline-none text-slate-700 dark:text-slate-200 w-full"
            />
            {locationQuery && (
              <button onClick={() => setLocationQuery("")} className="ml-1">
                <X className="h-3 w-3 text-slate-400" />
              </button>
            )}
          </div>

          {/* SUGGESTIONS DROPDOWN - FORCED SIZE */}
          {showSuggestions && (
            <div 
              className={cn(
                "absolute top-[120%] left-0 z-[100] py-4",
                "bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl border border-slate-50 dark:border-slate-700",
                "animate-in fade-in slide-in-from-top-1",
                "w-[320px] xs:w-[380px] sm:w-[450px] max-w-[calc(100vw-2rem)]" // Fixed widths with mobile safety
              )}
            >
              <p className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {isSearching ? "Searching..." : locationQuery ? "Top Matches" : "Start typing..."}
              </p>
              
              <div className="flex flex-col max-h-[340px] overflow-y-auto">
                {isSearching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                  </div>
                )}
                
                {!isSearching && suggestions.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => {
                      setLocationQuery(dest.location || dest.name);
                      setShowSuggestions(false);
                      handleApplyFilters();
                    }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 text-left group"
                  >
                    <div className="bg-slate-100 dark:bg-slate-600 p-3 rounded-xl group-hover:bg-teal-50 dark:group-hover:bg-teal-900 transition-colors">
                      <MapPin className="h-5 w-5 text-slate-500 dark:text-slate-300 group-hover:text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200 truncate">{dest.name}</p>
                      <p className="text-sm text-slate-400 font-medium">{dest.location}, {dest.country}</p>
                    </div>
                  </button>
                ))}

                {!isSearching && locationQuery && suggestions.length === 0 && (
                 <p className="px-5 py-6 text-sm font-bold text-slate-400 italic text-center">No matches found</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-600 self-center" />

        {/* FROM SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> From
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {dateFrom ? format(dateFrom, "MMM dd") : "Any date"}
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

        <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-600 self-center" />

        {/* TO SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> To
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {dateTo ? format(dateTo, "MMM dd") : "Any date"}
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

        {/* SEARCH BUTTON */}
        <button
          onClick={handleApplyFilters}
          className="flex items-center justify-center text-white h-full px-6 md:px-8 rounded-r-2xl transition-all hover:brightness-110 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
        >
          <Search className="w-5 h-5 stroke-[3px]" />
        </button>
      </div>
    </div>
  );
};