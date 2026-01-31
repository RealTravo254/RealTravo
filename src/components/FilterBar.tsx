import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const COLORS = {
  TEAL: "#008080",
};

interface FilterBarProps {
  category: "trip" | "hotel" | "adventure" | "event";
  onApplyFilters: (filters: { location: string; dateFrom?: Date; dateTo?: Date }) => void;
}

interface LocationSuggestion {
  name: string;
  place?: string;
  country?: string;
}

export const FilterBar = ({ category, onApplyFilters }: FilterBarProps) => {
  const [locationInput, setLocationInput] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions based on category and input
  useEffect(() => {
    const fetchLocations = async () => {
      if (locationInput.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      const tableMap = {
        trip: "trips",
        event: "trips",
        hotel: "hotels",
        adventure: "adventure_places",
      };

      const table = tableMap[category];
      
      try {
        let query = supabase
          .from(table)
          .select("name, place, country")
          .or(`name.ilike.%${locationInput}%,place.ilike.%${locationInput}%,country.ilike.%${locationInput}%`)
          .limit(5);

        if (category === "trip" || category === "event") {
          query = query.eq("type", category);
        }

        const { data, error } = await query;
        if (!error && data) setSuggestions(data);
      } catch (err) {
        console.error("Error fetching locations:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(fetchLocations, 300);
    return () => clearTimeout(debounce);
  }, [locationInput, category]);

  const handleApply = () => {
    onApplyFilters({
      location: locationInput,
      dateFrom,
      dateTo,
    });
    setShowDropdown(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 md:px-0 relative z-50">
      <div className="flex flex-row items-center bg-white border border-slate-100 rounded-2xl shadow-xl h-14 md:h-16">
        
        {/* WHERE SECTION */}
        <div className="flex flex-col flex-1 px-4 md:px-6 py-1 relative min-w-[140px]" ref={dropdownRef}>
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> Where
          </label>
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Destinations" 
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="bg-transparent border-none p-0 text-sm md:text-base focus:ring-0 placeholder:text-slate-300 font-bold outline-none text-slate-700 w-full"
            />
            {locationInput && (
                <X className="h-3 w-3 text-slate-300 cursor-pointer" onClick={() => setLocationInput("")} />
            )}
          </div>

          {/* Location Suggestions Dropdown */}
          {showDropdown && (locationInput || isSearching) && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
              {isSearching ? (
                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-teal-600" /></div>
              ) : suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setLocationInput(s.name);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-none"
                  >
                    <span className="text-sm font-bold text-slate-700">{s.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">
                      {s.place}{s.place && s.country ? ", " : ""}{s.country}
                    </span>
                  </button>
                ))
              ) : locationInput.length > 1 ? (
                <div className="p-4 text-[10px] font-bold text-slate-400 uppercase text-center">No matches found</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* FROM SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 transition-colors min-w-[80px] md:min-w-[120px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> From
              </span>
              <span className={cn("text-sm md:text-base font-bold", !dateFrom ? "text-slate-300" : "text-slate-700")}>
                {dateFrom ? format(dateFrom, "MMM dd") : "Add"}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* TO SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 transition-colors min-w-[80px] md:min-w-[120px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> To
              </span>
              <span className={cn("text-sm md:text-base font-bold", !dateTo ? "text-slate-300" : "text-slate-700")}>
                {dateTo ? format(dateTo, "MMM dd") : "Add"}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              disabled={(date) => (dateFrom ? date <= dateFrom : date < new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* APPLY BUTTON */}
        <div className="h-full">
          <button
            onClick={handleApply}
            className="flex items-center justify-center gap-2 text-white h-full px-5 md:px-8 transition-all hover:brightness-110 active:scale-95 border-none"
            style={{ background: `linear-gradient(135deg, ${COLORS.TEAL} 0%, #006666 100%)` }}
          >
            <Search className="w-5 h-5 stroke-[3px]" />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};