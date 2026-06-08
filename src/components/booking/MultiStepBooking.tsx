import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, isBefore, isAfter, parseISO } from "date-fns";
import { CalendarIcon, Users, Check, Loader2, Minus, Plus, Ticket, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

export interface BookingFormData {
  visit_date: string;
  num_adults: number;
  num_children: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  selectedActivities?: { name: string; price: number; numberOfPeople: number }[];
  selectedFacilities?: { name: string; price: number; startDate?: string; endDate?: string }[];
  ticketSelections?: { name: string; price: number; quantity: number }[];
}

interface Activity {
  name: string;
  price: number;
  images?: string[];
}

interface Facility {
  name: string;
  price: number;
  images?: string[];
}

interface TicketType {
  name: string;
  price: number;
}

interface MultiStepBookingProps {
  onSubmit: (data: BookingFormData) => Promise<void>;
  isProcessing: boolean;
  isCompleted: boolean;
  itemName: string;
  itemId: string;
  hostId: string;
  onPaymentSuccess: () => void;
  primaryColor?: string;
  accentColor?: string;
  bookingType?: string;
  priceAdult?: number;
  priceChild?: number;
  activities?: Activity[];
  facilities?: Facility[];
  skipFacilitiesAndActivities?: boolean;
  skipDateSelection?: boolean;
  fixedDate?: string;
  totalCapacity?: number;
  slotLimitType?: string;
  isFlexibleDate?: boolean;
  entranceType?: string;
  workingDays?: string[];
  ticketTypes?: TicketType[];
  allowChildren?: boolean;
  // NEW: when true, Activities and Facilities get their own separate steps
  separateActivitiesAndFacilities?: boolean;
}

const TEAL = "#008080";
const TEAL_DARK = "#006666";
const CORAL = "#FF7F50";

export const MultiStepBooking = ({
  onSubmit,
  isProcessing,
  isCompleted,
  itemName,
  itemId,
  priceAdult = 0,
  priceChild = 0,
  activities = [],
  facilities = [],
  skipFacilitiesAndActivities = false,
  skipDateSelection = false,
  fixedDate = "",
  totalCapacity = 100,
  workingDays = [],
  primaryColor = TEAL,
  accentColor = CORAL,
  ticketTypes = [],
  allowChildren = true,
  separateActivitiesAndFacilities = false,
}: MultiStepBookingProps) => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [visitDate, setVisitDate] = useState<Date | undefined>(
    fixedDate ? parseISO(fixedDate) : undefined
  );
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<
    { name: string; price: number; numberOfPeople: number }[]
  >([]);
  const [selectedFacilities, setSelectedFacilities] = useState<
    { name: string; price: number; startDate?: string; endDate?: string }[]
  >([]);
  const [isFacilityOnlyMode, setIsFacilityOnlyMode] = useState(false);
  const [ticketSelections, setTicketSelections] = useState<{ name: string; price: number; quantity: number }[]>(
    ticketTypes.map(t => ({ name: t.name, price: t.price, quantity: 0 }))
  );
  const [facilityBookedRanges, setFacilityBookedRanges] = useState<Record<string, { startDate: string; endDate: string }[]>>({});
  const [dateConflictWarning, setDateConflictWarning] = useState<string | null>(null);

  const hasTicketTypes = ticketTypes.length > 0;

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("name, phone_number")
          .eq("id", user.id)
          .single();
        if (data) {
          setGuestName(data.name || "");
          setGuestPhone(data.phone_number || "");
        }
        setGuestEmail(user.email || "");
      };
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    const facilityName = searchParams.get("facility");
    const skipToFacility = searchParams.get("skipToFacility");

    if (facilityName && skipToFacility === "true") {
      setIsFacilityOnlyMode(true);
      const targetFacility = facilities.find(
        f => f.name.toLowerCase() === decodeURIComponent(facilityName).toLowerCase()
      );
      if (targetFacility) {
        setSelectedFacilities([{
          name: targetFacility.name,
          price: targetFacility.price,
        }]);
      }
    }
  }, [searchParams, facilities]);

  // Fetch booked date ranges for all facilities
  const fetchFacilityBookedDates = useCallback(async () => {
    if (!itemId || facilities.length === 0) return;
    try {
      const { data } = await supabase
        .from("bookings")
        .select("booking_details")
        .eq("item_id", itemId)
        .in("status", ["confirmed", "pending"])
        .neq("payment_status", "failed");

      const rangesMap: Record<string, { startDate: string; endDate: string }[]> = {};
      data?.forEach((booking: any) => {
        const details = booking.booking_details;
        if (!details?.facilities) return;
        const bFacilities = Array.isArray(details.facilities) ? details.facilities : [];
        bFacilities.forEach((f: any) => {
          if (f.name && f.startDate && f.endDate) {
            if (!rangesMap[f.name]) rangesMap[f.name] = [];
            rangesMap[f.name].push({ startDate: f.startDate, endDate: f.endDate });
          }
        });
      });
      setFacilityBookedRanges(rangesMap);
    } catch (err) {
      console.error("Error fetching facility booked dates:", err);
    }
  }, [itemId, facilities]);

  useEffect(() => {
    fetchFacilityBookedDates();
  }, [fetchFacilityBookedDates]);

  const isFacilityDateBooked = useCallback((facilityName: string, date: Date): boolean => {
    const ranges = facilityBookedRanges[facilityName] || [];
    const dateStr = format(date, "yyyy-MM-dd");
    return ranges.some(r => dateStr >= r.startDate && dateStr < r.endDate);
  }, [facilityBookedRanges]);

  const isFacilityRangeAvailable = useCallback((facilityName: string, startDate: string, endDate: string): boolean => {
    const ranges = facilityBookedRanges[facilityName] || [];
    return !ranges.some(r => startDate < r.endDate && endDate > r.startDate);
  }, [facilityBookedRanges]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP DEFINITIONS
  // Key change: when separateActivitiesAndFacilities=true, "extras" is replaced
  // by two independent steps: "step_activities" and "step_facilities".
  // ─────────────────────────────────────────────────────────────────────────────
  const steps = [];

  if (isFacilityOnlyMode) {
    // Facility-only deep-link mode (unchanged)
    steps.push({ id: "facilities", title: "Select Dates" });
    if (activities.length > 0) {
      steps.push({ id: "activities", title: "Add Activities" });
    }
    if (!user) {
      steps.push({ id: "details", title: "Your Details" });
    }
    steps.push({ id: "review", title: "Review" });
  } else {
    if (!skipDateSelection) {
      steps.push({ id: "date", title: "Select Date" });
    }

    if (hasTicketTypes) {
      steps.push({ id: "tickets", title: "Select Tickets" });
    } else {
      steps.push({ id: "travelers", title: "Travelers" });
    }

    if (!skipFacilitiesAndActivities) {
      if (separateActivitiesAndFacilities) {
        // ── NEW: separate steps ──────────────────────────────────
        if (activities.length > 0) {
          steps.push({ id: "step_activities", title: "Activities" });
        }
        if (facilities.length > 0) {
          steps.push({ id: "step_facilities", title: "Facilities" });
        }
      } else {
        // ── ORIGINAL: combined extras step ──────────────────────
        if (activities.length > 0 || facilities.length > 0) {
          steps.push({ id: "extras", title: "Extras" });
        }
      }
    }

    if (!user) {
      steps.push({ id: "details", title: "Your Details" });
    }
    steps.push({ id: "review", title: "Review" });
  }

  const calculateTotal = () => {
    let total = 0;

    if (!isFacilityOnlyMode) {
      if (hasTicketTypes) {
        ticketSelections.forEach(t => total += t.price * t.quantity);
      } else {
        total = numAdults * priceAdult + numChildren * priceChild;
      }
    }

    selectedActivities.forEach((a) => (total += a.price * a.numberOfPeople));
    selectedFacilities.forEach((f) => {
      if (f.startDate && f.endDate) {
        const days = Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24)));
        total += f.price * days;
      }
    });
    return total;
  };

  const getTotalTickets = () => ticketSelections.reduce((sum, t) => sum + t.quantity, 0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    const totalTickets = hasTicketTypes ? getTotalTickets() : numAdults + numChildren;
    const formData: BookingFormData = {
      visit_date: visitDate ? format(visitDate, "yyyy-MM-dd") : fixedDate,
      num_adults: hasTicketTypes ? totalTickets : (isFacilityOnlyMode ? 0 : numAdults),
      num_children: hasTicketTypes ? 0 : (isFacilityOnlyMode ? 0 : numChildren),
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      selectedActivities,
      selectedFacilities,
      ticketSelections: hasTicketTypes ? ticketSelections.filter(t => t.quantity > 0) : undefined,
    };
    await onSubmit(formData);
  };

  const toggleActivity = (activity: Activity) => {
    const existing = selectedActivities.find((a) => a.name === activity.name);
    if (existing) {
      setSelectedActivities(selectedActivities.filter((a) => a.name !== activity.name));
    } else {
      setSelectedActivities([...selectedActivities, { name: activity.name, price: activity.price, numberOfPeople: 1 }]);
    }
  };

  const updateActivityPeople = (name: string, count: number) => {
    setSelectedActivities(selectedActivities.map((a) => a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a));
  };

  const toggleFacility = (facility: Facility) => {
    const existing = selectedFacilities.find((f) => f.name === facility.name);
    if (existing) {
      setSelectedFacilities(selectedFacilities.filter((f) => f.name !== facility.name));
    } else {
      setSelectedFacilities([...selectedFacilities, { name: facility.name, price: facility.price }]);
    }
  };

  const updateFacilityDates = (name: string, startDate?: string, endDate?: string) => {
    if (startDate && endDate && endDate <= startDate) {
      setDateConflictWarning(`Check-out date must be after check-in date for ${name}.`);
      return;
    }
    if (startDate && endDate) {
      if (!isFacilityRangeAvailable(name, startDate, endDate)) {
        setDateConflictWarning(`Selected dates for ${name} overlap with an existing booking. Please choose different dates.`);
        return;
      }
      setDateConflictWarning(null);
    }
    setSelectedFacilities(selectedFacilities.map((f) => f.name === name ? { ...f, startDate, endDate } : f));
  };

  const updateTicketQuantity = (name: string, quantity: number) => {
    const maxPerBooking = 20;
    const currentTotal = ticketSelections.reduce((sum, t) => sum + (t.name === name ? 0 : t.quantity), 0);
    const maxForThis = Math.min(totalCapacity, maxPerBooking) - currentTotal;
    setTicketSelections(ticketSelections.map(t => t.name === name ? { ...t, quantity: Math.max(0, Math.min(quantity, maxForThis)) } : t));
  };

  const currentStepId = steps[currentStep]?.id;

  const isStepValid = () => {
    switch (currentStepId) {
      case "date": return !!visitDate;
      case "travelers": return numAdults > 0 && (numAdults + numChildren) <= 20;
      case "tickets": {
        const total = getTotalTickets();
        return total > 0 && total <= 20;
      }
      case "facilities":
        return selectedFacilities.length > 0 &&
          selectedFacilities.some(f => f.startDate && f.endDate && f.endDate > f.startDate) &&
          !dateConflictWarning;
      // Separate steps — both optional, always valid to proceed
      case "step_activities": return true;
      case "step_facilities": return true;
      case "activities": return true;
      case "extras": return true;
      case "details": return guestName.trim() !== "" && guestEmail.trim() !== "" && guestPhone.trim() !== "";
      case "review": return true;
      default: return true;
    }
  };

  if (isCompleted) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: TEAL }}>
          <Check className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight mb-2">Booking Confirmed!</h3>
        <p className="text-muted-foreground text-sm">Thank you for booking {itemName}</p>
      </div>
    );
  }

  // ── Reusable activity card renderer ─────────────────────────────────────────
  const renderActivitiesList = () => (
    <div className="space-y-3">
      {activities.map((activity) => {
        const isSelected = selectedActivities.some((a) => a.name === activity.name);
        const selected = selectedActivities.find((a) => a.name === activity.name);
        return (
          <div
            key={activity.name}
            className={cn("p-4 border rounded-2xl cursor-pointer transition-all", isSelected && "border-2 border-[#008080] bg-[#008080]/5")}
            onClick={() => toggleActivity(activity)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(activity.price)} per person</p>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"
                      onClick={() => updateActivityPeople(activity.name, (selected?.numberOfPeople || 1) - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-bold">{selected?.numberOfPeople || 1}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"
                      onClick={() => updateActivityPeople(activity.name, (selected?.numberOfPeople || 1) + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {isSelected && selected && (
              <div className="mt-2 text-right">
                <span className="text-sm font-bold" style={{ color: TEAL }}>
                  {formatPrice(activity.price * (selected.numberOfPeople || 1))}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Reusable facility card renderer ─────────────────────────────────────────
  const renderFacilitiesList = () => (
    <div className="space-y-3">
      {facilities.map((facility) => {
        const isSelected = selectedFacilities.some((f) => f.name === facility.name);
        const selected = selectedFacilities.find((f) => f.name === facility.name);
        return (
          <div
            key={facility.name}
            className={cn("p-4 border rounded-2xl transition-all", isSelected && "border-2 border-[#008080] bg-[#008080]/5")}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => toggleFacility(facility)}
            >
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{facility.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(facility.price)} per day</p>
                </div>
                <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  isSelected ? "border-none bg-[#008080]" : "border-slate-300")}>
                  {isSelected && <Check className="h-4 w-4 text-white" />}
                </div>
              </div>
            </div>

            {isSelected && (
              <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("w-full justify-start text-left font-bold rounded-xl h-10 text-xs", !selected?.startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" style={{ color: TEAL }} />
                          {selected?.startDate ? format(parseISO(selected.startDate), "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single"
                          selected={selected?.startDate ? parseISO(selected.startDate) : undefined}
                          onSelect={(date) => { if (date) updateFacilityDates(facility.name, format(date, "yyyy-MM-dd"), selected?.endDate); }}
                          disabled={(date) => isBefore(date, new Date()) || isFacilityDateBooked(facility.name, date)}
                          modifiers={{ booked: (date) => isFacilityDateBooked(facility.name, date) }}
                          modifiersStyles={{ booked: { backgroundColor: '#fee2e2', color: '#ef4444', textDecoration: 'line-through' } }}
                          initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("w-full justify-start text-left font-bold rounded-xl h-10 text-xs", !selected?.endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" style={{ color: TEAL }} />
                          {selected?.endDate ? format(parseISO(selected.endDate), "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single"
                          selected={selected?.endDate ? parseISO(selected.endDate) : undefined}
                          onSelect={(date) => { if (date) updateFacilityDates(facility.name, selected?.startDate, format(date, "yyyy-MM-dd")); }}
                          disabled={(date) => isBefore(date, selected?.startDate ? parseISO(selected.startDate) : new Date()) || isFacilityDateBooked(facility.name, date)}
                          modifiers={{ booked: (date) => isFacilityDateBooked(facility.name, date) }}
                          modifiersStyles={{ booked: { backgroundColor: '#fee2e2', color: '#ef4444', textDecoration: 'line-through' } }}
                          initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {dateConflictWarning && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2 rounded-xl">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <span>{dateConflictWarning}</span>
                  </div>
                )}

                {selected?.startDate && selected?.endDate && selected.endDate > selected.startDate &&
                  isFacilityRangeAvailable(facility.name, selected.startDate, selected.endDate) && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-xl">
                      <Check className="h-3 w-3 flex-shrink-0" />
                      <span>Available for selected dates</span>
                    </div>
                    <div className="text-sm font-bold" style={{ color: TEAL }}>
                      {Math.max(1, Math.ceil((new Date(selected.endDate).getTime() - new Date(selected.startDate).getTime()) / (1000 * 60 * 60 * 24)))} nights
                      {" — "}
                      {formatPrice(facility.price * Math.max(1, Math.ceil((new Date(selected.endDate).getTime() - new Date(selected.startDate).getTime()) / (1000 * 60 * 60 * 24))))}
                    </div>
                  </>
                )}

                {selected?.startDate && selected?.endDate && selected.endDate > selected.startDate &&
                  !isFacilityRangeAvailable(facility.name, selected.startDate, selected.endDate) && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2 rounded-xl">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <span>Not available for selected dates. Please choose different dates.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="p-6">

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Booking Progress</p>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: TEAL }}>
            {currentStep + 1}/{steps.length}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%`, backgroundColor: TEAL }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step, index) => (
            <span key={step.id} className={cn("text-[9px] font-bold uppercase tracking-wider",
              index <= currentStep ? "text-[#008080]" : "text-slate-300")}>
              {step.title}
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-lg font-black uppercase tracking-tight mb-6" style={{ color: TEAL }}>
        {steps[currentStep]?.title}
      </h2>

      {/* ── FACILITY-ONLY MODE: Facilities with dates ─────────────────────── */}
      {currentStepId === "facilities" && isFacilityOnlyMode && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select check-in and check-out dates for your selected facility.
          </p>
          {renderFacilitiesList()}
        </div>
      )}

      {/* ── FACILITY-ONLY MODE: Activities ───────────────────────────────── */}
      {currentStepId === "activities" && isFacilityOnlyMode && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Add any activities to your booking? (Optional)
          </p>
          {renderActivitiesList()}
        </div>
      )}

      {/* ── DATE SELECTION ───────────────────────────────────────────────── */}
      {currentStepId === "date" && (
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            When would you like to visit?
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-bold rounded-2xl h-14 border-slate-200", !visitDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" style={{ color: TEAL }} />
                {visitDate ? format(visitDate, "PPP") : "Select a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={visitDate} onSelect={setVisitDate}
                disabled={(date) => isBefore(date, new Date())} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* ── TICKET TYPES ─────────────────────────────────────────────────── */}
      {currentStepId === "tickets" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground mb-2">
            Select the type and quantity of tickets. Maximum 20 per booking.
          </p>
          {getTotalTickets() >= 20 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Maximum limit of 20 tickets per booking reached.</span>
            </div>
          )}
          {ticketSelections.map((ticket) => (
            <div key={ticket.name} className={cn("p-4 border rounded-2xl transition-all",
              ticket.quantity > 0 ? "border-[#008080] bg-[#008080]/5" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: ticket.quantity > 0 ? "rgba(0,128,128,0.1)" : "rgba(100,116,139,0.08)" }}>
                    <Ticket className="h-4 w-4" style={{ color: ticket.quantity > 0 ? TEAL : "#94a3b8" }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm uppercase tracking-tight">{ticket.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(ticket.price)} each</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl"
                    onClick={() => updateTicketQuantity(ticket.name, ticket.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-black text-lg">{ticket.quantity}</span>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl"
                    onClick={() => updateTicketQuantity(ticket.name, ticket.quantity + 1)}
                    disabled={getTotalTickets() >= 20}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {ticket.quantity > 0 && (
                <div className="mt-2 text-right">
                  <span className="text-sm font-bold" style={{ color: TEAL }}>
                    {formatPrice(ticket.price * ticket.quantity)}
                  </span>
                </div>
              )}
            </div>
          ))}
          {getTotalTickets() > 0 && (
            <div className="p-4 rounded-2xl bg-[#008080]/5 border border-[#008080]/20 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Total Tickets</span>
              <span className="text-lg font-black" style={{ color: TEAL }}>{getTotalTickets()}</span>
            </div>
          )}
        </div>
      )}

      {/* ── TRAVELERS (no ticket types) ───────────────────────────────────── */}
      {currentStepId === "travelers" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Maximum 20 people per booking.</p>
          {(numAdults + numChildren) >= 20 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Maximum limit of 20 persons per booking reached.</span>
            </div>
          )}
          <div className="flex items-center justify-between p-4 border rounded-2xl border-slate-200">
            <div>
              <p className="font-bold text-sm">Adults</p>
              <p className="text-xs text-muted-foreground">{formatPrice(priceAdult)} each</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="rounded-xl"
                onClick={() => setNumAdults(Math.max(1, numAdults - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-black">{numAdults}</span>
              <Button variant="outline" size="icon" className="rounded-xl"
                onClick={() => setNumAdults(Math.min(Math.min(20, totalCapacity) - numChildren, numAdults + 1))}
                disabled={(numAdults + numChildren) >= 20}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {allowChildren && (
            <div className="flex items-center justify-between p-4 border rounded-2xl border-slate-200">
              <div>
                <p className="font-bold text-sm">Children</p>
                <p className="text-xs text-muted-foreground">{formatPrice(priceChild)} each</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="rounded-xl"
                  onClick={() => setNumChildren(Math.max(0, numChildren - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-black">{numChildren}</span>
                <Button variant="outline" size="icon" className="rounded-xl"
                  onClick={() => setNumChildren(Math.min(Math.min(20, totalCapacity) - numAdults, numChildren + 1))}
                  disabled={(numAdults + numChildren) >= 20}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEPARATE ACTIVITIES STEP ──────────────────────────────────────── */}
      {currentStepId === "step_activities" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">
            Choose any activities you'd like to add. (Optional)
          </p>
          {renderActivitiesList()}
          {selectedActivities.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#008080]/5 border border-[#008080]/20 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Activities Subtotal</span>
              <span className="text-base font-black" style={{ color: TEAL }}>
                {formatPrice(selectedActivities.reduce((s, a) => s + a.price * a.numberOfPeople, 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── SEPARATE FACILITIES STEP ──────────────────────────────────────── */}
      {currentStepId === "step_facilities" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">
            Choose any facilities you'd like to book. Select dates for each one. (Optional)
          </p>
          {renderFacilitiesList()}
          {selectedFacilities.filter(f => f.startDate && f.endDate).length > 0 && (
            <div className="p-4 rounded-2xl bg-[#008080]/5 border border-[#008080]/20 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Facilities Subtotal</span>
              <span className="text-base font-black" style={{ color: TEAL }}>
                {formatPrice(selectedFacilities.reduce((s, f) => {
                  if (!f.startDate || !f.endDate) return s;
                  const days = Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24)));
                  return s + f.price * days;
                }, 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── ORIGINAL COMBINED EXTRAS STEP ────────────────────────────────── */}
      {currentStepId === "extras" && (
        <div className="space-y-6">
          {activities.length > 0 && (
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight mb-3" style={{ color: TEAL }}>Activities</h3>
              {renderActivitiesList()}
            </div>
          )}
          {facilities.length > 0 && (
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight mb-3" style={{ color: TEAL }}>Facilities</h3>
              {renderFacilitiesList()}
            </div>
          )}
        </div>
      )}

      {/* ── GUEST DETAILS ─────────────────────────────────────────────────── */}
      {currentStepId === "details" && (
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
            <Input className="rounded-xl h-12 mt-1" value={guestName}
              onChange={(e) => setGuestName(e.target.value)} placeholder="Enter your full name" />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</Label>
            <Input className="rounded-xl h-12 mt-1" type="email" value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)} placeholder="Enter your email" />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
            <Input className="rounded-xl h-12 mt-1" type="tel" value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)} placeholder="Enter your phone number" />
          </div>
        </div>
      )}

      {/* ── REVIEW ───────────────────────────────────────────────────────── */}
      {currentStepId === "review" && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            {!isFacilityOnlyMode && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Date</span>
                  <span className="font-bold">{visitDate ? format(visitDate, "PPP") : fixedDate || "Flexible"}</span>
                </div>
                {hasTicketTypes ? (
                  ticketSelections.filter(t => t.quantity > 0).map((t) => (
                    <div key={t.name} className="flex justify-between text-sm">
                      <span className="text-slate-500">{t.name} × {t.quantity}</span>
                      <span className="font-bold">{formatPrice(t.price * t.quantity)}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Adults × {numAdults}</span>
                      <span className="font-bold">{formatPrice(numAdults * priceAdult)}</span>
                    </div>
                    {numChildren > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Children × {numChildren}</span>
                        <span className="font-bold">{formatPrice(numChildren * priceChild)}</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {selectedActivities.length > 0 && (
              <>
                <div className="border-t border-slate-200 pt-2 mt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Activities</p>
                  {selectedActivities.map((a) => (
                    <div key={a.name} className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500">{a.name} × {a.numberOfPeople}</span>
                      <span className="font-bold">{formatPrice(a.price * a.numberOfPeople)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedFacilities.length > 0 && (
              <>
                <div className="border-t border-slate-200 pt-2 mt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Facilities</p>
                  {selectedFacilities.map((f) => {
                    const days = f.startDate && f.endDate
                      ? Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24)))
                      : 1;
                    return (
                      <div key={f.name} className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">
                          {f.name} ({days} nights)
                          {f.startDate && f.endDate && (
                            <span className="text-[10px] text-slate-400 block">
                              {format(new Date(f.startDate), "MMM d")} - {format(new Date(f.endDate), "MMM d")}
                            </span>
                          )}
                        </span>
                        <span className="font-bold">{formatPrice(f.price * days)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between font-black text-lg">
              <span>Total</span>
              <span style={{ color: TEAL }}>{formatPrice(calculateTotal())}</span>
            </div>
          </div>

          <div className="p-4 border rounded-2xl border-slate-200 space-y-1">
            <p className="font-bold text-sm">{guestName || user?.email}</p>
            <p className="text-xs text-muted-foreground">{guestEmail || user?.email}</p>
            <p className="text-xs text-muted-foreground">{guestPhone}</p>
          </div>
        </div>
      )}

      {/* ── NAVIGATION BUTTONS ───────────────────────────────────────────── */}
      <div className="flex gap-3 mt-8">
        {currentStep > 0 && (
          <Button variant="outline" onClick={handleBack}
            className="flex-1 py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest border-slate-200">
            Back
          </Button>
        )}
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="flex-[2] py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
            style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`, boxShadow: `0 8px 20px -6px ${TEAL}88` }}
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || calculateTotal() <= 0}
            className="flex-[2] py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
            style={{ background: `linear-gradient(135deg, #FF9E7A 0%, ${CORAL} 100%)`, boxShadow: `0 8px 20px -6px ${CORAL}88` }}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              "Confirm Booking"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};