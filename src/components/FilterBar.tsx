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

export const FilterBar = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current date at midnight for comparison/defaults
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
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setShowSuggestions(true);
            }}
            className="bg-transparent border-none p-0 text-sm md:text-base focus:ring-0 placeholder:text-slate-300 font-bold outline-none text-slate-700 w-full"
          />

          {/* SUGGESTIONS DROPDOWN */}
          {showSuggestions && (
            <div className="absolute top-[115%] left-0 w-full md:w-[320px] bg-white rounded-[24px] shadow-2xl border border-slate-50 z-[100] py-3 animate-in fade-in slide-in-from-top-1">
              {/* ... (Suggestion mapping logic from previous step) */}
            </div>
          )}
        </div>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* FROM SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> From
              </span>
              <span className={cn("text-sm font-bold", !dateFrom ? "text-slate-300" : "text-slate-700")}>
                {dateFrom ? format(dateFrom, "MMM dd") : "Add"}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              disabled={(date) => date < today}
              // Force calendar to show current month on open
              defaultMonth={dateFrom || today} 
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className="w-[1px] h-8 bg-slate-100 self-center" />

        {/* TO SECTION */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-col px-4 md:px-6 py-1 cursor-pointer hover:bg-slate-50 min-w-[100px]">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" /> To
              </span>
              <span className={cn("text-sm font-bold", !dateTo ? "text-slate-300" : "text-slate-700")}>
                {dateTo ? format(dateTo, "MMM dd") : "Add"}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="center">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              // Prevent selecting a 'To' date before 'From' date
              disabled={(date) => (dateFrom ? date < dateFrom : date < today)}
              // Force calendar to show current month (or month of 'From' date) on open
              defaultMonth={dateTo || dateFrom || today}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* APPLY BUTTON */}
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