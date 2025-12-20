import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MapPin, Search, XCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

interface FilterBarProps {
  type: "trips-events" | "hotels" | "adventure";
  onApplyFilters: (filters: any) => void;
}

export const FilterBar = ({ type, onApplyFilters }: FilterBarProps) => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, [type]);

  const fetchLocations = async () => {
    const uniqueLocations = new Set<string>();
    try {
      const tableMap = {
        "trips-events": "trips",
        "hotels": "hotels",
        "adventure": "adventure_places"
      };
      
      const { data } = await supabase
        .from(tableMap[type] as any)
        .select("location, place, country")
        .eq("approval_status", "approved");

      (data || []).forEach((item: any) => {
        if (item.location) uniqueLocations.add(item.location);
        if (item.place) uniqueLocations.add(item.place);
        if (item.country) uniqueLocations.add(item.country);
      });
      setLocations(Array.from(uniqueLocations).sort());
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const filteredLocations = locations.filter(loc => 
    loc.toLowerCase().includes(location.toLowerCase())
  );

  const handleApply = () => {
    const validationError = validateFilters();
    if (validationError) return alert(validationError);

    const filters: any = {};
    if (type === "trips-events") {
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
    } else if (type === "hotels") {
      if (checkIn) filters.checkIn = checkIn;
      if (checkOut) filters.checkOut = checkOut;
    }
    if (location) filters.location = location;
    
    onApplyFilters(filters);
  };

  const validateFilters = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [dateFrom, dateTo, checkIn, checkOut];
    if (dates.some(d => d && d < today)) return "Dates cannot be in the past";
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-white via-white to-slate-50 rounded-2xl p-3 shadow-md border border-[#008080]/10 relative overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, ${COLORS.TEAL} 0%, ${COLORS.CORAL} 100%)` }} />
      
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        {/* Location Input */}
        <div className="flex-1 relative">
          <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Destination</Label>
          <div className="relative group">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-[#FF7F50] transition-colors" />
            <Input
              placeholder="Where to?"
              value={location}
              onChange={(e) => { setLocation(e.target.value); setShowLocationSuggestions(true); }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              className="pl-8 h-9 bg-slate-50 border-none rounded-xl text-xs font-bold placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-[#FF7F50]/20"
            />
          </div>
          {showLocationSuggestions && location && filteredLocations.length > 0 && (
            <div className="absolute z-[100] w-full bg-white border border-slate-100 rounded-xl mt-1 max-h-36 overflow-y-auto shadow-xl p-1.5 animate-in fade-in slide-in-from-top-2">
              {filteredLocations.slice(0, 5).map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocation(loc); setShowLocationSuggestions(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold uppercase tracking-tight text-slate-600 transition-colors"
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Controls */}
        {type !== "adventure" && (
          <>
            <div className="flex-1">
              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                {type === "hotels" ? "Check-In" : "From"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-9 bg-slate-50 border-none rounded-xl text-xs font-bold group px-2.5"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels" 
                      ? (checkIn ? format(checkIn, "MMM d") : <span className="text-slate-300">Date</span>)
                      : (dateFrom ? format(dateFrom, "MMM d") : <span className="text-slate-300">Date</span>)
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-xl overflow-hidden" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkIn : dateFrom}
                    onSelect={type === "hotels" ? setCheckIn : setDateFrom}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-2"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                {type === "hotels" ? "Check-Out" : "To"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-9 bg-slate-50 border-none rounded-xl text-xs font-bold group px-2.5"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels" 
                      ? (checkOut ? format(checkOut, "MMM d") : <span className="text-slate-300">Date</span>)
                      : (dateTo ? format(dateTo, "MMM d") : <span className="text-slate-300">Date</span>)
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-xl overflow-hidden" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkOut : dateTo}
                    onSelect={type === "hotels" ? setCheckOut : setDateTo}
                    disabled={(date) => {
                      const baseDate = (type === "hotels" ? checkIn : dateFrom) || new Date();
                      return date <= baseDate;
                    }}
                    className="p-2"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleApply} 
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 border-none"
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
            }}
          >
            <Search className="h-3.5 w-3.5 mr-1" />
            Search
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDateFrom(undefined); setDateTo(undefined);
              setCheckIn(undefined); setCheckOut(undefined);
              setLocation(""); onApplyFilters({});
            }}
            className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};