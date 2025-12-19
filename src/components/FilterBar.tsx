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
    <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: COLORS.TEAL }}>
            Find Your Next {type === 'hotels' ? 'Stay' : 'Adventure'}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Tailor your search criteria
          </p>
        </div>
        <Search className="h-5 w-5 text-slate-300" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Location Input */}
        <div className="space-y-2 relative">
          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destination</Label>
          <div className="relative group">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#FF7F50] transition-colors" />
            <Input
              placeholder="Where to?"
              value={location}
              onChange={(e) => { setLocation(e.target.value); setShowLocationSuggestions(true); }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              className="pl-10 h-12 bg-slate-50 border-none rounded-2xl text-sm font-bold placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[#FF7F50]/20 transition-all"
            />
          </div>
          {showLocationSuggestions && location && filteredLocations.length > 0 && (
            <div className="absolute z-[100] w-full bg-white border border-slate-100 rounded-2xl mt-2 max-h-48 overflow-y-auto shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
              {filteredLocations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocation(loc); setShowLocationSuggestions(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-tight text-slate-600 transition-colors"
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
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {type === "hotels" ? "Check-In" : "Date From"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-12 bg-slate-50 border-none rounded-2xl text-sm font-bold group"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels" 
                      ? (checkIn ? format(checkIn, "PP") : <span className="text-slate-300">Select Date</span>)
                      : (dateFrom ? format(dateFrom, "PP") : <span className="text-slate-300">Select Date</span>)
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl overflow-hidden" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkIn : dateFrom}
                    onSelect={type === "hotels" ? setCheckIn : setDateFrom}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {type === "hotels" ? "Check-Out" : "Date To"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-12 bg-slate-50 border-none rounded-2xl text-sm font-bold group"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels" 
                      ? (checkOut ? format(checkOut, "PP") : <span className="text-slate-300">Select Date</span>)
                      : (dateTo ? format(dateTo, "PP") : <span className="text-slate-300">Select Date</span>)
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl overflow-hidden" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkOut : dateTo}
                    onSelect={type === "hotels" ? setCheckOut : setDateTo}
                    disabled={(date) => {
                      const baseDate = (type === "hotels" ? checkIn : dateFrom) || new Date();
                      return date <= baseDate;
                    }}
                    className="p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3 pt-2">
        <Button 
          onClick={handleApply} 
          className="flex-1 h-14 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 border-none"
          style={{ 
            background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
            boxShadow: `0 8px 20px -6px ${COLORS.CORAL}88`
          }}
        >
          Apply Filters
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setDateFrom(undefined); setDateTo(undefined);
            setCheckIn(undefined); setCheckOut(undefined);
            setLocation(""); onApplyFilters({});
          }}
          className="h-14 px-8 rounded-2xl bg-[#F0E68C]/10 text-[#857F3E] hover:bg-[#F0E68C]/30 text-[10px] font-black uppercase tracking-widest border border-[#F0E68C]/20"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
};