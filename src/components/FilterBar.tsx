import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

  const handleApply = () => {
    const validationError = validateFilters();
    if (validationError) {
      // You could show a toast here
      alert(validationError);
      return;
    }

    const filters: any = {};
    
    if (type === "trips-events") {
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (location) filters.location = location;
    } else if (type === "hotels") {
      if (checkIn) filters.checkIn = checkIn;
      if (checkOut) filters.checkOut = checkOut;
      if (location) filters.location = location;
    } else if (type === "adventure") {
      if (location) filters.location = location;
    }
    
    onApplyFilters(filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  // Get unique locations from database
  const [locations, setLocations] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  
  useEffect(() => {
    fetchLocations();
  }, [type]);

  const fetchLocations = async () => {
    const uniqueLocations = new Set<string>();
    
    try {
      if (type === "trips-events") {
        const { data } = await supabase.from("trips").select("location, place, country").eq("approval_status", "approved");
        (data || []).forEach(item => {
          if (item.location) uniqueLocations.add(item.location);
          if (item.place) uniqueLocations.add(item.place);
          if (item.country) uniqueLocations.add(item.country);
        });
      } else if (type === "hotels") {
        const { data } = await supabase.from("hotels").select("location, place, country").eq("approval_status", "approved");
        (data || []).forEach(item => {
          if (item.location) uniqueLocations.add(item.location);
          if (item.place) uniqueLocations.add(item.place);
          if (item.country) uniqueLocations.add(item.country);
        });
      } else if (type === "adventure") {
        const { data } = await supabase.from("adventure_places").select("location, place, country").eq("approval_status", "approved");
        (data || []).forEach(item => {
          if (item.location) uniqueLocations.add(item.location);
          if (item.place) uniqueLocations.add(item.place);
          if (item.country) uniqueLocations.add(item.country);
        });
      }
      setLocations(Array.from(uniqueLocations).sort());
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const filteredLocations = locations.filter(loc => 
    loc.toLowerCase().includes(location.toLowerCase())
  );

  const validateFilters = () => {
    // Validate dates are not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateFrom && dateFrom < today) {
      return "Start date cannot be in the past";
    }
    if (dateTo && dateTo < today) {
      return "End date cannot be in the past";
    }
    if (checkIn && checkIn < today) {
      return "Check-in date cannot be in the past";
    }
    if (checkOut && checkOut < today) {
      return "Check-out date cannot be in the past";
    }
    
    return null;
  };

  return (
    <div className="bg-primary/10 p-2 md:p-4 rounded-none space-y-2 md:space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm md:text-base">Filters</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        {type === "trips-events" && (
          <>
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {dateFrom ? format(dateFrom, "PP") : <span>Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 relative col-span-1">
              <Label className="text-xs md:text-sm">Location</Label>
              <Input
                placeholder="Enter location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                onKeyPress={handleKeyPress}
                className="text-xs md:text-sm h-8 md:h-10"
              />
              {showLocationSuggestions && location && filteredLocations.length > 0 && (
                <div className="absolute z-10 w-full bg-background border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-xs md:text-sm"
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationSuggestions(false);
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {type === "hotels" && (
          <>
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Check-In</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !checkIn && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {checkIn ? format(checkIn, "PP") : <span>Check-in</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={checkIn}
                    onSelect={setCheckIn}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Check-Out</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !checkOut && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {checkOut ? format(checkOut, "PP") : <span>Check-out</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={checkOut}
                    onSelect={setCheckOut}
                    disabled={(date) => {
                      const today = new Date(new Date().setHours(0, 0, 0, 0));
                      if (checkIn) {
                        return date <= checkIn;
                      }
                      return date < today;
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 relative">
              <Label className="text-xs md:text-sm">Location</Label>
              <Input
                placeholder="Enter location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                onKeyPress={handleKeyPress}
                className="text-xs md:text-sm h-8 md:h-10"
              />
              {showLocationSuggestions && location && filteredLocations.length > 0 && (
                <div className="absolute z-10 w-full bg-background border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-xs md:text-sm"
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationSuggestions(false);
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
  
        {type === "adventure" && (
          <div className="space-y-2 relative">
            <Label className="text-xs md:text-sm">Location</Label>
            <Input
              placeholder="Enter location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
              onKeyPress={handleKeyPress}
              className="text-xs md:text-sm h-8 md:h-10"
            />
              {showLocationSuggestions && location && filteredLocations.length > 0 && (
                <div className="absolute z-10 w-full bg-background border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-xs md:text-sm"
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationSuggestions(false);
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1 text-xs md:text-sm h-8 md:h-10">
          Apply
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDateFrom(undefined);
            setDateTo(undefined);
            setCheckIn(undefined);
            setCheckOut(undefined);
            setLocation("");
            onApplyFilters({});
          }}
          className="text-xs md:text-sm h-8 md:h-10"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
