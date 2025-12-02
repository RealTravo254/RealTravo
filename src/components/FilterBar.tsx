import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
// Removed Input and Label as Location field is gone
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
// Removed supabase dependency as location fetching is gone

interface FilterBarProps {
  type: "trips-events" | "hotels" | "adventure";
  onApplyFilters: (filters: any) => void;
}

export const FilterBar = ({ type, onApplyFilters }: FilterBarProps) => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  // Removed location state

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
      // Removed location filter
    } else if (type === "hotels") {
      if (checkIn) filters.checkIn = checkIn;
      if (checkOut) filters.checkOut = checkOut;
      // Removed location filter
    } else if (type === "adventure") {
      // Adventure type now has no filters in this bar, as Location is handled by SearchBar
      // You might add price range or other custom filters here later
    }
    
    onApplyFilters(filters);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  // Removed all location state, useEffect, and fetching logic (fetchLocations, filteredLocations)

  const validateFilters = () => {
    // Validate dates are not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Trips/Events Date validation
    if (dateFrom && dateFrom < today) {
      return "Start date cannot be in the past";
    }
    if (dateTo && dateTo < today) {
      return "End date cannot be in the past";
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return "Start date cannot be after end date";
    }

    // Hotels Date validation
    if (checkIn && checkIn < today) {
      return "Check-in date cannot be in the past";
    }
    if (checkOut && checkOut < today) {
      return "Check-out date cannot be in the past";
    }
    if (checkIn && checkOut && checkIn > checkOut) {
      return "Check-in date cannot be after Check-out date";
    }
    
    return null;
  };

  return (
    <div className="bg-primary/10 p-2 md:p-4 rounded-none space-y-2 md:space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm md:text-base">Filters</h3>
      </div>
      
      {/* The grid layout is updated based on the remaining visible inputs.
        If only one date input is shown for trips/events, it spans two columns for better alignment.
      */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        {/* --- Trips & Events Filters --- */}
        {type === "trips-events" && (
          <>
            <div className="space-y-2">
              <label className="text-xs md:text-sm">Date From</label>
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
                    {dateFrom ? format(dateFrom, "PP") : <span>Start Date</span>}
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
            
            {/* Date To */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm">Date To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {dateTo ? format(dateTo, "PP") : <span>End Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Note: Location field removed */}
          </>
        )}

        {/* --- Hotels Filters --- */}
        {type === "hotels" && (
          <>
            <div className="space-y-2">
              <label className="text-xs md:text-sm">Check-In</label>
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
              <label className="text-xs md:text-sm">Check-Out</label>
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
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Note: Location field removed */}
          </>
        )}

        {/* --- Adventure Filters (Now empty) --- */}
        {type === "adventure" && (
          <div className="col-span-full text-center text-muted-foreground py-2">
            Use the main search bar for location filtering.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1 text-xs md:text-sm h-8 md:h-10">
          Apply Filters
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDateFrom(undefined);
            setDateTo(undefined);
            setCheckIn(undefined);
            setCheckOut(undefined);
            // setLocation(""); // Removed
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