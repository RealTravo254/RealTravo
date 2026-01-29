import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, XCircle } from "lucide-react";
import { format } from "date-fns";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA",
};

export interface FilterValues {
  location?: string;
  dateFrom?: Date;
  dateTo?: Date;
  checkIn?: Date;
  checkOut?: Date;
}

interface FilterBarProps {
  type: "trips-events" | "hotels" | "adventure";
  onApplyFilters: (filters: FilterValues) => void;
}

export const FilterBar = ({ type, onApplyFilters }: FilterBarProps) => {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();

  const handleApply = () => {
    const validationError = validateFilters();
    if (validationError) return alert(validationError);

    const filters: FilterValues = {};

    if (type === "trips-events") {
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
    } else if (type === "hotels") {
      if (checkIn) filters.checkIn = checkIn;
      if (checkOut) filters.checkOut = checkOut;
    }

    onApplyFilters(filters);
  };

  const handleClear = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setCheckIn(undefined);
    setCheckOut(undefined);
    onApplyFilters({});
  };

  const validateFilters = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [dateFrom, dateTo, checkIn, checkOut];
    if (dates.some((d) => d && d < today)) return "Dates cannot be in the past";
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 shadow-sm border-b border-slate-200 dark:border-slate-700 relative overflow-visible rounded-none">
      {/* Decorative accent line at the top */}
      <div
        className="absolute top-0 left-0 w-full h-0.5"
        style={{ background: `linear-gradient(90deg, ${COLORS.TEAL} 0%, ${COLORS.CORAL} 100%)` }}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end gap-4">
        {/* Date Controls */}
        {type !== "adventure" && (
          <>
            <div className="flex-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                {type === "hotels" ? "Check-In" : "From Date"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold group px-3"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels"
                      ? checkIn
                        ? format(checkIn, "PPP")
                        : <span className="text-slate-400">Select date</span>
                      : dateFrom
                        ? format(dateFrom, "PPP")
                        : <span className="text-slate-400">Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkIn : dateFrom}
                    onSelect={type === "hotels" ? setCheckIn : setDateFrom}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                {type === "hotels" ? "Check-Out" : "To Date"}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold group px-3"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 group-hover:text-[#FF7F50]" />
                    {type === "hotels"
                      ? checkOut
                        ? format(checkOut, "PPP")
                        : <span className="text-slate-400">Select date</span>
                      : dateTo
                        ? format(dateTo, "PPP")
                        : <span className="text-slate-400">Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="start">
                  <Calendar
                    mode="single"
                    selected={type === "hotels" ? checkOut : dateTo}
                    onSelect={type === "hotels" ? setCheckOut : setDateTo}
                    disabled={(date) => {
                      const baseDate = (type === "hotels" ? checkIn : dateFrom) || new Date();
                      return date <= baseDate;
                    }}
                    initialFocus
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
            className="h-10 px-6 rounded-lg text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-all active:scale-95 border-none"
            style={{
              background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
            }}
          >
            <Search className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
            title="Clear Filters"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};