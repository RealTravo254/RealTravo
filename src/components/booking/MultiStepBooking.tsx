import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isBefore, parseISO, addDays, startOfDay } from "date-fns";
import { CalendarIcon, Check, Loader2, Minus, Plus, Ticket, AlertCircle, Globe, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  fetchBookedByDate,
  fetchFacilityBookedDays,
  getRangeConflictDays,
} from "@/lib/availability";

// ─────────────────────────────────────────────────────────────────────────────
// Dark-mode lockout
// ─────────────────────────────────────────────────────────────────────────────
// This booking flow must always render in light mode, regardless of any
// app-wide dark mode toggle applied by an ancestor. We scope the standard
// shadcn/ui light CSS variables to a wrapper class so every component here
// (Button, Popover, Calendar, Input, etc.) resolves to light-theme colors
// even if a `dark` class exists higher up in the DOM.
//
// IMPORTANT: Radix UI portals (used by Popover/Calendar popups) render their
// content as a direct child of <body>, NOT inside this component's DOM tree.
// That means the `.rt-multistep-force-light` wrapper class never wraps the
// popover/calendar popup content, so CSS variables scoped only to the
// wrapper won't reach it. To fix this, we also toggle a class directly on
// <body> while this component is mounted (and remove it on unmount) — since
// portaled content is still a DOM descendant of <body>, it inherits the same
// CSS custom properties from there.
const LOCK_LIGHT_CLASS = "rt-multistep-force-light";
const BODY_LOCK_CLASS = "rt-multistep-portal-light";

const ForceLightModeStyles = () => (
  <style>{`
    .${LOCK_LIGHT_CLASS},
    body.${BODY_LOCK_CLASS} {
      color-scheme: light;
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 222.2 84% 4.9%;
    }
    .${LOCK_LIGHT_CLASS}, .${LOCK_LIGHT_CLASS} *,
    body.${BODY_LOCK_CLASS} [data-radix-popper-content-wrapper],
    body.${BODY_LOCK_CLASS} [data-radix-popper-content-wrapper] * {
      color-scheme: light;
    }
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpecialPriceTier {
  id: string;
  label: string;
  citizen_price: number;
  non_citizen_price: number;
  requirement?: string;
}

export interface EntryTicketSelection {
  /** "citizen_adult" | "citizen_child" | "non_citizen_adult" | "non_citizen_child" | tier.id */
  type: string;
  label: string;
  price: number;
  quantity: number;
}

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
  /** New: entry-ticket breakdown for adventure_place */
  entryTicketSelections?: EntryTicketSelection[];
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
  /** New entry-fee fields from adventure_places */
  nonCitizenEntryFee?: number;
  nonCitizenChildEntryFee?: number;
  hasNonCitizenPricing?: boolean;
  specialEntryPrices?: SpecialPriceTier[];
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
  separateActivitiesAndFacilities?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEAL      = "#008080";
const TEAL_DARK = "#006666";
const CORAL     = "#FF7F50";

const BOOKED_STYLE = { backgroundColor: "#fee2e2", color: "#ef4444", textDecoration: "line-through" };

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const isValidPhone = (phone: string) => {
  const digits = phone.replace(/\s+/g, "");
  if (digits.length === 10) return /^(07|01)\d{8}$/.test(digits);
  if (digits.length === 13) return /^\+\d{12}$/.test(digits);
  return false;
};

const formatDay = (key: string) => format(parseISO(key), "EEE, MMM d");

// ── Working-day helpers ─────────────────────────────────────────────────────
// workingDays can arrive in mixed formats ("Mon", "Monday", "MON", etc). We
// normalize to a 3-letter lowercase abbreviation so it reliably lines up
// with the day-of-week produced by Date#getDay(). An empty list — or a list
// that (once normalized) already covers all 7 distinct days — means "open
// every day", so nothing gets disabled.
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const normalizeDayAbbrev = (d: string) =>
  String(d ?? "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase();

const isWorkingDayDate = (date: Date, workingDays: string[]): boolean => {
  if (!workingDays || workingDays.length === 0) return true;
  const normalized = workingDays.map(normalizeDayAbbrev).filter(Boolean);
  const unique = new Set(normalized);
  if (unique.size >= 7) return true;
  const dayAbbrev = normalizeDayAbbrev(DAY_NAMES[date.getDay()]);
  return unique.has(dayAbbrev);
};

// Small legend used under both the visit-date calendar and the facility
// start/end date calendars so it's always clear what each color means.
const CalendarLegend = ({ showBooked = false }: { showBooked?: boolean }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" /> Available
    </span>
    {showBooked && (
      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fee2e2" }} /> Booked
      </span>
    )}
    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
      <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Closed
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const MultiStepBooking = ({
  onSubmit,
  isProcessing,
  isCompleted,
  itemName,
  itemId,
  priceAdult = 0,
  priceChild = 0,
  nonCitizenEntryFee = 0,
  nonCitizenChildEntryFee = 0,
  hasNonCitizenPricing = false,
  specialEntryPrices = [],
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
  bookingType,
}: MultiStepBookingProps) => {
  const { user }          = useAuth();
  const { formatPrice }   = useCurrency();
  const [searchParams]    = useSearchParams();

  const isAdventurePlace = bookingType === "adventure_place";

  // ── Dark-mode lockout: force light mode on <body> while mounted so that
  // Radix portal content (Popover/Calendar popups) also renders in light mode,
  // since that content is appended to document.body, outside this component's
  // own DOM subtree. ────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.add(BODY_LOCK_CLASS);
    return () => {
      document.body.classList.remove(BODY_LOCK_CLASS);
    };
  }, []);

  // ── Step state ─────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);

  // ── Date ───────────────────────────────────────────────────────────────────
  const [visitDate, setVisitDate] = useState<Date | undefined>(
    fixedDate ? parseISO(fixedDate) : undefined
  );

  // ── Legacy travelers (trips / events) ─────────────────────────────────────
  const [numAdults,   setNumAdults]   = useState(1);
  const [numChildren, setNumChildren] = useState(0);

  // ── Guest details ──────────────────────────────────────────────────────────
  const [guestName,  setGuestName]  = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // ── Activities / Facilities ────────────────────────────────────────────────
  const [selectedActivities, setSelectedActivities] = useState<
    { name: string; price: number; numberOfPeople: number }[]
  >([]);
  const [selectedFacilities, setSelectedFacilities] = useState<
    { name: string; price: number; startDate?: string; endDate?: string }[]
  >([]);

  // ── Facility-only mode ─────────────────────────────────────────────────────
  const [isFacilityOnlyMode, setIsFacilityOnlyMode] = useState(false);

  // ── Standard ticket types (trips / events) ─────────────────────────────────
  const [ticketSelections, setTicketSelections] = useState<
    { name: string; price: number; quantity: number }[]
  >(ticketTypes.map(t => ({ name: t.name, price: t.price, quantity: 0 })));

  // ── NEW: Entry ticket selections for adventure_place ───────────────────────
  const [entryTickets, setEntryTickets] = useState<EntryTicketSelection[]>(() => {
    const base: EntryTicketSelection[] = [];

    // Citizen adult (always shown for adventure_place)
    if (isAdventurePlace) {
      base.push({ type: "citizen_adult",    label: "Citizen – Adult",    price: priceAdult,             quantity: 0 });
      if (allowChildren)
        base.push({ type: "citizen_child",   label: "Citizen – Child",    price: priceChild,             quantity: 0 });
      if (hasNonCitizenPricing) {
        base.push({ type: "non_citizen_adult", label: "Non-Citizen – Adult", price: nonCitizenEntryFee,      quantity: 0 });
        if (allowChildren)
          base.push({ type: "non_citizen_child", label: "Non-Citizen – Child", price: nonCitizenChildEntryFee, quantity: 0 });
      }
      specialEntryPrices.forEach(tier => {
        base.push({
          type:     tier.id,
          label:    tier.label,
          price:    tier.citizen_price,
          quantity: 0,
        });
      });
    }
    return base;
  });

  // ── Booked days (by OTHER people) ──────────────────────────────────────────
  // facilityBookedDays: every day a facility is already taken, per facility.
  // dateBooked: slots already booked per visit date for this item.
  const [facilityBookedDays, setFacilityBookedDays] = useState<Record<string, Set<string>>>({});
  const [dateBooked, setDateBooked] = useState<Map<string, number>>(new Map());
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError,     setAvailabilityError]     = useState<string | null>(null);

  const hasTicketTypes = ticketTypes.length > 0;
  const facilityKey = facilities.map(f => f.name).join("|");

  // ── Pre-fill from auth ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
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
    })();
  }, [user]);

  // ── Facility-only mode from URL params ────────────────────────────────────
  useEffect(() => {
    const facilityName    = searchParams.get("facility");
    const skipToFacility  = searchParams.get("skipToFacility");
    if (facilityName && skipToFacility === "true") {
      setIsFacilityOnlyMode(true);
      const target = facilities.find(
        f => f.name.toLowerCase() === decodeURIComponent(facilityName).toLowerCase()
      );
      if (target) {
        setSelectedFacilities([{ name: target.name, price: target.price }]);
      }
    }
  }, [searchParams, facilities]);

  // ── Load facility booked days (security-definer RPC, sees everyone's bookings) ──
  const loadFacilityBookedDays = useCallback(async (): Promise<Record<string, Set<string>>> => {
    if (!itemId || facilities.length === 0) return {};
    const today = startOfDay(new Date());
    const days = await fetchFacilityBookedDays(
      itemId,
      facilities.map(f => f.name),
      today,
      addDays(today, 365)
    );
    setFacilityBookedDays(days);
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, facilityKey]);

  useEffect(() => {
    loadFacilityBookedDays().catch(err => console.error("Error fetching facility booked dates:", err));
  }, [loadFacilityBookedDays]);

  // ── Load slots already booked per visit date ──────────────────────────────
  const refreshDateBooked = useCallback(async () => {
    if (!itemId || totalCapacity <= 0) return;
    try {
      const today = startOfDay(new Date());
      setDateBooked(await fetchBookedByDate(itemId, today, addDays(today, 365)));
    } catch (err) {
      console.error("Error fetching date availability:", err);
    }
  }, [itemId, totalCapacity]);

  useEffect(() => { refreshDateBooked(); }, [refreshDateBooked]);

  // ── Visit-date helpers ─────────────────────────────────────────────────────
  const slotsLeftOn = (date: Date) =>
    Math.max(0, totalCapacity - (dateBooked.get(format(date, "yyyy-MM-dd")) || 0));

  const isDateFull = (date: Date) => totalCapacity > 0 && slotsLeftOn(date) <= 0;

  // Max people this booking can add on the chosen date (Infinity = unknown/unlimited)
  const peopleCap = visitDate && totalCapacity > 0 ? slotsLeftOn(visitDate) : Infinity;

  // ── Facility date helpers ──────────────────────────────────────────────────
  const isFacilityDateBooked = useCallback((name: string, date: Date): boolean =>
    !!facilityBookedDays[name]?.has(format(date, "yyyy-MM-dd")),
  [facilityBookedDays]);

  /** Every booked day inside the stay, including days in between. Check-out day stays free. */
  const getFacilityConflictDays = useCallback((name: string, start?: string, end?: string): string[] =>
    getRangeConflictDays(facilityBookedDays[name], start, end),
  [facilityBookedDays]);

  const isFacilityRangeAvailable = useCallback((name: string, start: string, end: string): boolean =>
    getFacilityConflictDays(name, start, end).length === 0,
  [getFacilityConflictDays]);

  // ── Live availability check (fresh from the database) ─────────────────────
  const checkFacilityAvailabilityLive = async (): Promise<boolean> => {
    const withDates = selectedFacilities.filter(f => f.startDate && f.endDate);
    if (withDates.length === 0) return true;

    setIsCheckingAvailability(true);
    setAvailabilityError(null);
    try {
      const fresh = await loadFacilityBookedDays();

      const conflicts: string[] = [];
      for (const f of withDates) {
        const days = getRangeConflictDays(fresh[f.name], f.startDate, f.endDate);
        if (days.length > 0) {
          conflicts.push(`${f.name} (${days.map(formatDay).join(", ")})`);
        }
      }
      if (conflicts.length > 0) {
        setAvailabilityError(
          `Sorry — already booked by someone else: ${conflicts.join("; ")}. Please choose different dates.`
        );
        return false;
      }
      return true;
    } catch {
      setAvailabilityError("Could not verify availability. Please check your connection and try again.");
      return false;
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const getFacilityDateValidationError = (f: { name: string; startDate?: string; endDate?: string }) => {
    if (!f.startDate || !f.endDate) return "Please choose both a start and end date.";
    if (f.endDate <= f.startDate)   return "Check-out must be after check-in.";
    const days = getFacilityConflictDays(f.name, f.startDate, f.endDate);
    if (days.length > 0)
      return `Already booked on: ${days.map(formatDay).join(", ")}. Please choose different dates.`;
    return "";
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Total calculation
  // ─────────────────────────────────────────────────────────────────────────

  const calculateEntryTotal = () =>
    entryTickets.reduce((s, t) => s + t.price * t.quantity, 0);

  const calculateTotal = () => {
    let total = 0;

    if (isAdventurePlace && !isFacilityOnlyMode) {
      total += calculateEntryTotal();
    } else if (!isFacilityOnlyMode) {
      if (hasTicketTypes) {
        ticketSelections.forEach(t => (total += t.price * t.quantity));
      } else {
        total = numAdults * priceAdult + numChildren * priceChild;
      }
    }

    selectedActivities.forEach(a => (total += a.price * a.numberOfPeople));
    selectedFacilities.forEach(f => {
      if (f.startDate && f.endDate) {
        const days = Math.max(
          1,
          Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000)
        );
        total += f.price * days;
      }
    });
    return total;
  };

  const getTotalTickets = () => ticketSelections.reduce((s, t) => s + t.quantity, 0);
  const getTotalEntryPeople = () => entryTickets.reduce((s, t) => s + t.quantity, 0);
  const currentTotalAmount = calculateTotal();
  const canSkipExtras =
    currentTotalAmount > 0 ||
    selectedActivities.length > 0 ||
    selectedFacilities.length > 0 ||
    getTotalTickets() > 0 ||
    getTotalEntryPeople() > 0 ||
    (!hasTicketTypes && !isAdventurePlace && numAdults + numChildren > 0);

  // ── Free-entry rule ───────────────────────────────────────────────────────
  // If the visit itself is not paid (free entry), it can't be booked on its own:
  // the guest must also book a paid activity or a facility (with dates).
  const entryIsFree =
    isAdventurePlace && !isFacilityOnlyMode && getTotalEntryPeople() > 0 && calculateEntryTotal() <= 0;
  const hasPaidExtra =
    selectedActivities.some(a => a.price * a.numberOfPeople > 0) ||
    selectedFacilities.some(f => !!f.startDate && !!f.endDate && f.price > 0);
  const mustAddExtra = entryIsFree && !hasPaidExtra;

  const freeEntryNotice = mustAddExtra ? (
    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span>
        Entry here is free, so a visit can't be booked on its own. Please add at least one activity or facility to continue.
      </span>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────────────
  // Steps
  // ─────────────────────────────────────────────────────────────────────────

  const steps: { id: string; title: string }[] = [];

  if (isFacilityOnlyMode) {
    steps.push({ id: "facilities", title: "Select Dates" });
    if (activities.length > 0) steps.push({ id: "activities", title: "Add Activities" });
    if (!user) steps.push({ id: "details", title: "Your Details" });
    steps.push({ id: "review", title: "Review" });
  } else {
    if (!skipDateSelection) steps.push({ id: "date", title: "Select Date" });

    if (isAdventurePlace) {
      steps.push({ id: "entry_tickets", title: "Entry Tickets" });
    } else if (hasTicketTypes) {
      steps.push({ id: "tickets", title: "Select Tickets" });
    } else {
      steps.push({ id: "travelers", title: "Travelers" });
    }

    if (!skipFacilitiesAndActivities) {
      if (separateActivitiesAndFacilities) {
        if (facilities.length > 0) steps.push({ id: "step_facilities", title: "Facilities" });
        if (activities.length > 0) steps.push({ id: "step_activities", title: "Activities" });
      } else {
        if (activities.length > 0 || facilities.length > 0)
          steps.push({ id: "extras", title: "Extras" });
      }
    }
    if (!user) steps.push({ id: "details", title: "Your Details" });
    steps.push({ id: "review", title: "Review" });
  }

  const currentStepId = steps[currentStep]?.id;

  // The last of the extras steps (facilities / activities) is where the free-entry rule is enforced
  const lastExtrasIndex = steps.reduce(
    (acc, st, i) => (["step_facilities", "step_activities", "extras"].includes(st.id) ? i : acc),
    -1
  );
  const isLastExtrasStep = currentStep === lastExtrasIndex;

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  const handleNext = async () => {
    const isFacilityStep =
      currentStepId === "facilities" ||
      currentStepId === "step_facilities" ||
      currentStepId === "extras";
    const hasFacilitiesSelected = selectedFacilities.some(f => f.startDate && f.endDate);

    if (isFacilityStep && hasFacilitiesSelected) {
      const ok = await checkFacilityAvailabilityLive();
      if (!ok) return;
    }
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
  };

  const handleBack = () => {
    setAvailabilityError(null);
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (mustAddExtra || calculateTotal() <= 0) return;
    const totalTickets = hasTicketTypes ? getTotalTickets() : numAdults + numChildren;

    // ── Final live checks BEFORE payment ──────────────────────────────────
    setAvailabilityError(null);
    setIsCheckingAvailability(true);
    let allClear = true;
    try {
      // 1) The visit date must still have enough free slots (other people may have booked)
      if (!isFacilityOnlyMode && visitDate && totalCapacity > 0) {
        const key    = format(visitDate, "yyyy-MM-dd");
        const booked = await fetchBookedByDate(itemId, visitDate, visitDate);
        const left   = Math.max(0, totalCapacity - (booked.get(key) || 0));
        const people = isAdventurePlace
          ? getTotalEntryPeople()
          : (hasTicketTypes ? getTotalTickets() : numAdults + numChildren);

        if (left < Math.max(1, people)) {
          setAvailabilityError(
            left === 0
              ? `${format(visitDate, "PPP")} is fully booked by other guests. Please go back and choose another date.`
              : `Only ${left} slot${left > 1 ? "s" : ""} left on ${format(visitDate, "PPP")} (you selected ${people}). Please reduce your tickets or choose another date.`
          );
          refreshDateBooked();
          allClear = false;
        }
      }
    } catch {
      setAvailabilityError("Could not verify availability. Please check your connection and try again.");
      allClear = false;
    } finally {
      setIsCheckingAvailability(false);
    }
    if (!allClear) return;

    // 2) Every facility day (including days in between) must still be free
    const facilitiesOk = await checkFacilityAvailabilityLive();
    if (!facilitiesOk) return;

    const formData: BookingFormData = {
      visit_date:   visitDate ? format(visitDate, "yyyy-MM-dd") : fixedDate,
      num_adults:   isAdventurePlace
        ? entryTickets.filter(t => t.type.includes("adult")).reduce((s, t) => s + t.quantity, 0)
        : (hasTicketTypes ? totalTickets : (isFacilityOnlyMode ? 0 : numAdults)),
      num_children: isAdventurePlace
        ? entryTickets.filter(t => t.type.includes("child")).reduce((s, t) => s + t.quantity, 0)
        : (hasTicketTypes ? 0 : (isFacilityOnlyMode ? 0 : numChildren)),
      guest_name:   guestName,
      guest_email:  guestEmail,
      guest_phone:  guestPhone,
      selectedActivities,
      selectedFacilities,
      ticketSelections:      hasTicketTypes ? ticketSelections.filter(t => t.quantity > 0) : undefined,
      entryTicketSelections: isAdventurePlace ? entryTickets.filter(t => t.quantity > 0) : undefined,
    };
    await onSubmit(formData);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Step validation
  // ─────────────────────────────────────────────────────────────────────────

  const isStepValid = (): boolean => {
    switch (currentStepId) {
      case "date":          return !!visitDate && !isDateFull(visitDate);
      case "travelers":     return numAdults > 0 && (numAdults + numChildren) <= 20;
      case "entry_tickets":
        // free entry + nothing to add on later steps = nothing bookable
        return getTotalEntryPeople() > 0 && !(mustAddExtra && lastExtrasIndex === -1);
      case "tickets": {
        const total = getTotalTickets();
        return total > 0 && total <= 20;
      }
      case "facilities":
      case "step_facilities": {
        if (mustAddExtra && isLastExtrasStep) return false;
        if (selectedFacilities.length === 0) return true;
        return selectedFacilities.every(f => !getFacilityDateValidationError(f));
      }
      case "activities":
      case "step_activities":
        if (mustAddExtra && isLastExtrasStep) return false;
        return canSkipExtras;
      case "extras": {
        if (mustAddExtra) return false;
        if (selectedFacilities.length === 0 && selectedActivities.length === 0) return canSkipExtras;
        return selectedFacilities.every(f => !getFacilityDateValidationError(f));
      }
      case "details":
        return guestName.trim() !== "" && isValidEmail(guestEmail) && isValidPhone(guestPhone);
      case "review": return true;
      default:       return true;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Entry-ticket helpers
  // ─────────────────────────────────────────────────────────────────────────

  const updateEntryTicket = (type: string, delta: number) => {
    // Never let the booking exceed the slots still free on the chosen date
    if (delta > 0 && getTotalEntryPeople() >= peopleCap) return;
    setEntryTickets(prev =>
      prev.map(t =>
        t.type === type
          ? { ...t, quantity: Math.max(0, Math.min(t.quantity + delta, 50)) }
          : t
      )
    );
  };

  // Resolve the correct price for a special tier (citizen vs non-citizen)
  // We show citizen_price by default; host can also set non_citizen_price on special tiers.
  // For simplicity we keep a single row per tier but show the citizen price.
  const getSpecialTierNonCitizenPrice = (tierId: string): number => {
    const tier = specialEntryPrices.find(t => t.id === tierId);
    return tier?.non_citizen_price ?? 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Activity / Facility renderers
  // ─────────────────────────────────────────────────────────────────────────

  const toggleActivity = (activity: Activity) => {
    const exists = selectedActivities.find(a => a.name === activity.name);
    if (exists) setSelectedActivities(prev => prev.filter(a => a.name !== activity.name));
    else        setSelectedActivities(prev => [...prev, { name: activity.name, price: activity.price, numberOfPeople: 1 }]);
  };

  const updateActivityPeople = (name: string, count: number) => {
    setSelectedActivities(prev => prev.map(a => a.name === name ? { ...a, numberOfPeople: Math.max(1, count) } : a));
  };

  const toggleFacility = (facility: Facility) => {
    setAvailabilityError(null);
    const exists = selectedFacilities.find(f => f.name === facility.name);
    if (exists) setSelectedFacilities(prev => prev.filter(f => f.name !== facility.name));
    else        setSelectedFacilities(prev => [...prev, { name: facility.name, price: facility.price }]);
  };

  // The chosen dates are always kept so the guest can SEE the problem; invalid or
  // booked ranges are flagged on screen and block "Continue" (see isStepValid).
  const updateFacilityDates = (name: string, startDate?: string, endDate?: string) => {
    setAvailabilityError(null);
    setSelectedFacilities(prev => prev.map(f => f.name === name ? { ...f, startDate, endDate } : f));
  };

  const updateTicketQuantity = (name: string, quantity: number) => {
    const maxPerBooking  = 20;
    const currentTotal   = ticketSelections.reduce((s, t) => s + (t.name === name ? 0 : t.quantity), 0);
    const maxForThis     = Math.min(totalCapacity, maxPerBooking, peopleCap) - currentTotal;
    setTicketSelections(prev =>
      prev.map(t => t.name === name ? { ...t, quantity: Math.max(0, Math.min(quantity, maxForThis)) } : t)
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderActivitiesList = () => (
    <div className="space-y-3">
      {activities.map(activity => {
        const isSelected = selectedActivities.some(a => a.name === activity.name);
        const selected   = selectedActivities.find(a => a.name === activity.name);
        return (
          <div
            key={activity.name}
            className={cn("p-4 border rounded-2xl cursor-pointer transition-all",
              isSelected && "border-2 border-[#008080] bg-[#008080]/5")}
            onClick={() => toggleActivity(activity)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(activity.price)} per person</p>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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

  const renderFacilitiesList = () => (
    <div className="space-y-3">
      {facilities.map(facility => {
        const isSelected    = selectedFacilities.some(f => f.name === facility.name);
        const selected      = selectedFacilities.find(f => f.name === facility.name);
        const upcomingBooked = Array.from(facilityBookedDays[facility.name] || []).sort();
        const conflictDays  = selected ? getFacilityConflictDays(facility.name, selected.startDate, selected.endDate) : [];
        const facilityError = selected ? getFacilityDateValidationError(selected) : "";
        const nights = selected?.startDate && selected?.endDate
          ? Math.max(1, Math.ceil((new Date(selected.endDate).getTime() - new Date(selected.startDate).getTime()) / 86400000))
          : 0;
        return (
          <div key={facility.name}
            className={cn("p-4 border rounded-2xl transition-all",
              isSelected && "border-2 border-[#008080] bg-[#008080]/5")}>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleFacility(facility)}>
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
              <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("w-full justify-start text-left font-bold rounded-xl h-10 text-xs",
                            !selected?.startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" style={{ color: TEAL }} />
                          {selected?.startDate ? format(parseISO(selected.startDate), "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single"
                          selected={selected?.startDate ? parseISO(selected.startDate) : undefined}
                          onSelect={date => { if (date) updateFacilityDates(facility.name, format(date, "yyyy-MM-dd"), selected?.endDate); }}
                          disabled={date =>
                            isBefore(date, new Date()) ||
                            isFacilityDateBooked(facility.name, date) ||
                            !isWorkingDayDate(date, workingDays)
                          }
                          modifiers={{
                            booked: date => isFacilityDateBooked(facility.name, date),
                            closed: date => !isWorkingDayDate(date, workingDays),
                          }}
                          modifiersStyles={{
                            booked: BOOKED_STYLE,
                            closed: { opacity: 0.35, textDecoration: "line-through" },
                          }}
                          initialFocus />
                        <div className="px-3 pb-3">
                          <CalendarLegend showBooked />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase text-slate-400">End Date (check-out)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("w-full justify-start text-left font-bold rounded-xl h-10 text-xs",
                            !selected?.endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" style={{ color: TEAL }} />
                          {selected?.endDate ? format(parseISO(selected.endDate), "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {/* Booked days stay selectable here as check-out, but any booked
                            day INSIDE the stay is flagged and blocks the booking. */}
                        <Calendar mode="single"
                          selected={selected?.endDate ? parseISO(selected.endDate) : undefined}
                          onSelect={date => { if (date) updateFacilityDates(facility.name, selected?.startDate, format(date, "yyyy-MM-dd")); }}
                          disabled={date =>
                            isBefore(date, selected?.startDate ? parseISO(selected.startDate) : new Date()) ||
                            !isWorkingDayDate(date, workingDays)
                          }
                          modifiers={{
                            booked: date => isFacilityDateBooked(facility.name, date),
                            closed: date => !isWorkingDayDate(date, workingDays),
                          }}
                          modifiersStyles={{
                            booked: BOOKED_STYLE,
                            closed: { opacity: 0.35, textDecoration: "line-through" },
                          }}
                          initialFocus />
                        <div className="px-3 pb-3">
                          <CalendarLegend showBooked />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Quick-glance legend so people don't have to open a picker to
                    understand the color coding used inside it. */}
                <CalendarLegend showBooked />

                {/* Booked day(s) inside the chosen stay — blocks the booking */}
                {conflictDays.length > 0 && (
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-600">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {conflictDays.length === 1 ? "Day already booked" : "Days already booked"}
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      Someone else has already booked {facility.name} on these days, so it can't be booked for your dates. Please choose different dates.
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {conflictDays.map(d => (
                        <li key={d} className="text-[11px] font-bold text-red-600">• {formatDay(d)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {facilityError && conflictDays.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2 rounded-xl">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" /><span>{facilityError}</span>
                  </div>
                )}

                {upcomingBooked.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                    <p className="font-bold uppercase tracking-[0.2em] mb-2">Already booked days</p>
                    <div className="flex flex-wrap gap-1.5">
                      {upcomingBooked.slice(0, 12).map(d => (
                        <span key={d} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-500 border border-red-100">
                          {format(parseISO(d), "MMM d")}
                        </span>
                      ))}
                      {upcomingBooked.length > 12 && (
                        <span className="text-[10px] font-bold text-slate-400 self-center">
                          +{upcomingBooked.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selected?.startDate && selected?.endDate && selected.endDate > selected.startDate &&
                  conflictDays.length === 0 && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-xl">
                      <Check className="h-3 w-3 flex-shrink-0" /><span>Available for all selected days</span>
                    </div>
                    <div className="text-sm font-bold" style={{ color: TEAL }}>
                      {nights} nights
                      {" — "}
                      {formatPrice(facility.price * nights)}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Completion screen
  // ─────────────────────────────────────────────────────────────────────────

  if (isCompleted) {
    return (
      <div className={`${LOCK_LIGHT_CLASS} p-8 text-center`} style={{ colorScheme: "light" }}>
        <ForceLightModeStyles />
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: TEAL }}>
          <Check className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight mb-2">Booking Confirmed!</h3>
        <p className="text-muted-foreground text-sm">Thank you for booking {itemName}</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entry ticket step renderer
  // ─────────────────────────────────────────────────────────────────────────

  const renderEntryTickets = () => {
    // Split into groups for visual clarity
    const citizenTickets    = entryTickets.filter(t => t.type.startsWith("citizen_"));
    const nonCitizenTickets = entryTickets.filter(t => t.type.startsWith("non_citizen_"));
    const specialTickets    = entryTickets.filter(t => !t.type.startsWith("citizen_") && !t.type.startsWith("non_citizen_"));

    const TicketRow = ({
      ticket,
      icon,
      badgeLabel,
      badgeColor,
      requirementNote,
    }: {
      ticket: EntryTicketSelection;
      icon: React.ReactNode;
      badgeLabel?: string;
      badgeColor?: string;
      requirementNote?: string;
    }) => {
      const isActive = ticket.quantity > 0;
      return (
        <div className={cn(
          "p-4 border rounded-2xl transition-all",
          isActive ? "border-2 bg-[#008080]/5" : "border-slate-200 bg-white"
        )} style={isActive ? { borderColor: TEAL } : {}}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("p-2 rounded-xl flex-shrink-0",
                isActive ? "bg-[#008080]/15" : "bg-slate-100")}>
                {icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate">{ticket.label}</p>
                  {badgeLabel && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: badgeColor + "22", color: badgeColor }}>
                      {badgeLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatPrice(ticket.price)} per person</p>
                {requirementNote && (
                  <p className="text-[10px] text-amber-600 mt-0.5">{requirementNote}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
                onClick={() => updateEntryTicket(ticket.type, -1)}>
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center font-black text-base tabular-nums">{ticket.quantity}</span>
              <button
                className="w-8 h-8 rounded-xl border flex items-center justify-center active:scale-95 transition-all"
                style={{ borderColor: TEAL, backgroundColor: isActive ? TEAL : "transparent", color: isActive ? "white" : TEAL }}
                onClick={() => updateEntryTicket(ticket.type, 1)}>
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isActive && (
            <div className="mt-2 flex justify-end">
              <span className="text-sm font-black" style={{ color: TEAL }}>
                {formatPrice(ticket.price * ticket.quantity)}
              </span>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-5">
        {/* Tip */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          Select the number of tickets per category. You need at least 1 ticket to continue.
          {Number.isFinite(peopleCap) && (
            <span className="block mt-1 font-bold text-slate-600">
              {peopleCap} slot{peopleCap === 1 ? "" : "s"} left on {visitDate ? format(visitDate, "PPP") : "this date"}.
            </span>
          )}
        </div>

        {entryIsFree && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Entry is free here. To complete a booking you'll also need to add an activity or a facility on the next steps.
              {lastExtrasIndex === -1 && " This place has none available to add, so it can't be booked online."}
            </span>
          </div>
        )}

        {Number.isFinite(peopleCap) && getTotalEntryPeople() >= peopleCap && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>That's all the slots left on this date. Go back to pick another date for more people.</span>
          </div>
        )}

        {/* Citizen tickets */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-3.5 w-3.5" style={{ color: TEAL }} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {hasNonCitizenPricing || specialEntryPrices.length > 0 ? "Citizen Rates" : "Entry Tickets"}
            </p>
          </div>
          <div className="space-y-3">
            {citizenTickets.map(t => (
              <TicketRow key={t.type} ticket={t}
                icon={<Ticket className="h-4 w-4" style={{ color: TEAL }} />}
                badgeLabel="Citizen"
                badgeColor="#008080"
              />
            ))}
          </div>
        </div>

        {/* Non-citizen tickets */}
        {nonCitizenTickets.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Non-Citizen Rates
              </p>
            </div>
            <div className="space-y-3">
              {nonCitizenTickets.map(t => (
                <TicketRow key={t.type} ticket={t}
                  icon={<Globe className="h-4 w-4 text-blue-500" />}
                  badgeLabel="Non-Citizen"
                  badgeColor="#3b82f6"
                />
              ))}
            </div>
          </div>
        )}

        {/* Special / custom tiers */}
        {specialTickets.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Special Rates
              </p>
            </div>
            <div className="space-y-3">
              {specialTickets.map(t => {
                const tierDef = specialEntryPrices.find(x => x.id === t.type);
                const nonCitPrice = getSpecialTierNonCitizenPrice(t.type);
                return (
                  <div key={t.type}>
                    <TicketRow ticket={t}
                      icon={<Star className="h-4 w-4 text-amber-500" />}
                      badgeLabel={t.label}
                      badgeColor="#f59e0b"
                      requirementNote={tierDef?.requirement}
                    />
                    {/* If there's also a non-citizen price for this tier, show it inline */}
                    {hasNonCitizenPricing && nonCitPrice > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 ml-1">
                        Non-citizen rate: {formatPrice(nonCitPrice)} — contact the host to apply.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Running total */}
        {getTotalEntryPeople() > 0 && (
          <div className="p-4 rounded-2xl flex justify-between items-center"
            style={{ backgroundColor: `${TEAL}12`, border: `1px solid ${TEAL}33` }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entry Total</p>
              <p className="text-xs text-slate-400">{getTotalEntryPeople()} person{getTotalEntryPeople() > 1 ? "s" : ""}</p>
            </div>
            <span className="text-xl font-black" style={{ color: TEAL }}>
              {formatPrice(calculateEntryTotal())}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`${LOCK_LIGHT_CLASS} p-6`} style={{ colorScheme: "light" }}>
      <ForceLightModeStyles />

      {/* Progress bar */}
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
          {steps.map((step, i) => (
            <span key={step.id} className={cn("text-[9px] font-bold uppercase tracking-wider",
              i <= currentStep ? "text-[#008080]" : "text-slate-300")}>
              {step.title}
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-lg font-black uppercase tracking-tight mb-6" style={{ color: TEAL }}>
        {steps[currentStep]?.title}
      </h2>

      {/* ── DATE ── */}
      {currentStepId === "date" && (
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            When would you like to visit?
          </Label>

          {/* Open / working days at a glance */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Open Days
            </p>
            {workingDays.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {workingDays.map((day, i) => (
                  <span key={i}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide"
                    style={{ backgroundColor: `${TEAL}15`, color: TEAL }}>
                    {day}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-500">Open every day</p>
            )}
          </div>

          {/* Inline calendar — no button/popover, the calendar itself is the
              date picker. Past dates, closed days and days that are already
              fully booked by other guests are disabled and shown struck-through. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <Calendar
              mode="single"
              selected={visitDate}
              onSelect={setVisitDate}
              disabled={date =>
                isBefore(date, new Date()) ||
                !isWorkingDayDate(date, workingDays) ||
                isDateFull(date)
              }
              modifiers={{
                closed: date => !isWorkingDayDate(date, workingDays),
                full:   date => isDateFull(date),
              }}
              modifiersStyles={{
                closed: { opacity: 0.35, textDecoration: "line-through" },
                full:   BOOKED_STYLE,
              }}
              className="mx-auto"
              initialFocus
            />
          </div>

          <CalendarLegend showBooked={totalCapacity > 0} />

          {visitDate && (
            <div className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ backgroundColor: `${TEAL}10` }}>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 flex-shrink-0" style={{ color: TEAL }} />
                <span className="text-sm font-bold" style={{ color: TEAL }}>
                  {format(visitDate, "PPP")}
                </span>
              </div>
              {totalCapacity > 0 && (
                <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: TEAL }}>
                  {slotsLeftOn(visitDate)} slots left
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ENTRY TICKETS (adventure_place) ── */}
      {currentStepId === "entry_tickets" && renderEntryTickets()}

      {/* ── STANDARD TICKET TYPES ── */}
      {currentStepId === "tickets" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground mb-2">Select ticket type and quantity. Maximum 20 per booking.</p>
          {getTotalTickets() >= 20 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Maximum limit of 20 tickets per booking reached.</span>
            </div>
          )}
          {Number.isFinite(peopleCap) && getTotalTickets() >= peopleCap && getTotalTickets() < 20 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Only {peopleCap} slot{peopleCap === 1 ? "" : "s"} left for this date.</span>
            </div>
          )}
          {ticketSelections.map(ticket => (
            <div key={ticket.name}
              className={cn("p-4 border rounded-2xl transition-all",
                ticket.quantity > 0 ? "border-[#008080] bg-[#008080]/5" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl"
                    style={{ backgroundColor: ticket.quantity > 0 ? "rgba(0,128,128,0.1)" : "rgba(100,116,139,0.08)" }}>
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
                    disabled={getTotalTickets() >= Math.min(20, peopleCap)}>
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

      {/* ── TRAVELERS ── */}
      {currentStepId === "travelers" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Maximum 20 people per booking.</p>
          {Number.isFinite(peopleCap) && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
              {peopleCap} slot{peopleCap === 1 ? "" : "s"} left on {visitDate ? format(visitDate, "PPP") : "this date"}.
            </div>
          )}
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
                onClick={() => setNumAdults(Math.max(1, Math.min(Math.min(20, totalCapacity, peopleCap) - numChildren, numAdults + 1)))}
                disabled={(numAdults + numChildren) >= Math.min(20, peopleCap)}>
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
                  onClick={() => setNumChildren(Math.max(0, Math.min(Math.min(20, totalCapacity, peopleCap) - numAdults, numChildren + 1)))}
                  disabled={(numAdults + numChildren) >= Math.min(20, peopleCap)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FACILITY-ONLY: facilities ── */}
      {currentStepId === "facilities" && isFacilityOnlyMode && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
            Select the facility dates you need. Both start and end dates are required before proceeding.
          </div>
          {currentTotalAmount <= 0 && selectedFacilities.length === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Please select a facility so the total amount is above KES 0.
            </div>
          )}
          {renderFacilitiesList()}
          {availabilityError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-2xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{availabilityError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── FACILITY-ONLY: activities ── */}
      {currentStepId === "activities" && isFacilityOnlyMode && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">Add any activities to your booking? (Optional)</p>
          {renderActivitiesList()}
        </div>
      )}

      {/* ── SEPARATE ACTIVITIES STEP ── */}
      {currentStepId === "step_activities" && (
        <div className="space-y-4">
          {mustAddExtra ? freeEntryNotice : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              No activities? You can skip this step.
            </div>
          )}
          {currentTotalAmount <= 0 && selectedActivities.length === 0 && selectedFacilities.length === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Your booking has no payable items yet. Add an activity or facility.
            </div>
          )}
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

      {/* ── SEPARATE FACILITIES STEP ── */}
      {currentStepId === "step_facilities" && (
        <div className="space-y-4">
          {mustAddExtra ? freeEntryNotice : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              No facilities? You can skip this step. Start and end dates are required per facility.
            </div>
          )}
          {currentTotalAmount <= 0 && selectedFacilities.length === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Your booking has no payable items yet.
            </div>
          )}
          {availabilityError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-2xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{availabilityError}</span>
            </div>
          )}
          {renderFacilitiesList()}
          {selectedFacilities.filter(f => f.startDate && f.endDate).length > 0 && (
            <div className="p-4 rounded-2xl bg-[#008080]/5 border border-[#008080]/20 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Facilities Subtotal</span>
              <span className="text-base font-black" style={{ color: TEAL }}>
                {formatPrice(selectedFacilities.reduce((s, f) => {
                  if (!f.startDate || !f.endDate) return s;
                  const days = Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000));
                  return s + f.price * days;
                }, 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── COMBINED EXTRAS STEP ── */}
      {currentStepId === "extras" && (
        <div className="space-y-6">
          {mustAddExtra ? freeEntryNotice : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              No extras? You can skip this step.
            </div>
          )}
          {currentTotalAmount <= 0 && selectedActivities.length === 0 && selectedFacilities.length === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
              Please choose at least one item before continuing.
            </div>
          )}
          {availabilityError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-2xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{availabilityError}</span>
            </div>
          )}
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

      {/* ── GUEST DETAILS ── */}
      {currentStepId === "details" && (
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
            <Input className="rounded-xl h-12 mt-1" value={guestName}
              onChange={e => setGuestName(e.target.value)} placeholder="Enter your full name" />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</Label>
            <Input
              className={cn("rounded-xl h-12 mt-1",
                guestEmail && !isValidEmail(guestEmail) && "border-red-400 focus-visible:ring-red-300")}
              type="email" value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)} placeholder="name@domain.com" />
            {guestEmail && !isValidEmail(guestEmail) && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                Enter a valid email address (e.g. name@gmail.com)
              </p>
            )}
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
            <Input
              className={cn("rounded-xl h-12 mt-1",
                guestPhone && !isValidPhone(guestPhone) && "border-red-400 focus-visible:ring-red-300")}
              type="tel" value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)} placeholder="07XXXXXXXX or +254XXXXXXXXX" />
            {guestPhone && !isValidPhone(guestPhone) && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                Use 07/01 + 8 digits or +[country code] + 9 digits
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {currentStepId === "review" && (
        <div className="space-y-4">
          {freeEntryNotice}
          {availabilityError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-2xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{availabilityError}</span>
            </div>
          )}

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">

            {/* Date */}
            {!isFacilityOnlyMode && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-bold">
                  {visitDate ? format(visitDate, "PPP") : fixedDate || "Flexible"}
                </span>
              </div>
            )}

            {/* Entry tickets (adventure_place) */}
            {isAdventurePlace && !isFacilityOnlyMode &&
              entryTickets.filter(t => t.quantity > 0).map(t => (
                <div key={t.type} className="flex justify-between text-sm">
                  <span className="text-slate-500">{t.label} × {t.quantity}</span>
                  <span className="font-bold">{formatPrice(t.price * t.quantity)}</span>
                </div>
              ))
            }

            {/* Standard ticket types */}
            {!isAdventurePlace && hasTicketTypes &&
              ticketSelections.filter(t => t.quantity > 0).map(t => (
                <div key={t.name} className="flex justify-between text-sm">
                  <span className="text-slate-500">{t.name} × {t.quantity}</span>
                  <span className="font-bold">{formatPrice(t.price * t.quantity)}</span>
                </div>
              ))
            }

            {/* Legacy adults / children */}
            {!isAdventurePlace && !hasTicketTypes && !isFacilityOnlyMode && (
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

            {/* Activities */}
            {selectedActivities.length > 0 && (
              <div className="border-t border-slate-200 pt-2 mt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Activities</p>
                {selectedActivities.map(a => (
                  <div key={a.name} className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">{a.name} × {a.numberOfPeople}</span>
                    <span className="font-bold">{formatPrice(a.price * a.numberOfPeople)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Facilities */}
            {selectedFacilities.length > 0 && (
              <div className="border-t border-slate-200 pt-2 mt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Facilities</p>
                {selectedFacilities.map(f => {
                  const days = f.startDate && f.endDate
                    ? Math.max(1, Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000))
                    : 1;
                  return (
                    <div key={f.name} className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500">
                        {f.name} ({days} nights)
                        {f.startDate && f.endDate && (
                          <span className="text-[10px] text-slate-400 block">
                            {format(new Date(f.startDate), "MMM d")} – {format(new Date(f.endDate), "MMM d")}
                          </span>
                        )}
                      </span>
                      <span className="font-bold">{formatPrice(f.price * days)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grand total */}
            <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between font-black text-lg">
              <span>Total</span>
              <span style={{ color: TEAL }}>{formatPrice(calculateTotal())}</span>
            </div>
          </div>

          {/* Guest card */}
          <div className="p-4 border rounded-2xl border-slate-200 space-y-1">
            <p className="font-bold text-sm">{guestName || user?.email}</p>
            <p className="text-xs text-muted-foreground">{guestEmail || user?.email}</p>
            <p className="text-xs text-muted-foreground">{guestPhone}</p>
          </div>
        </div>
      )}

      {/* ── NAVIGATION BUTTONS ── */}
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
            disabled={!isStepValid() || isCheckingAvailability}
            className="flex-[2] py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
            style={{
              background:   `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`,
              boxShadow:    `0 8px 20px -6px ${TEAL}88`,
            }}
          >
            {isCheckingAvailability
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking availability...</>
              : "Continue"}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || isCheckingAvailability || mustAddExtra || calculateTotal() <= 0}
            className="flex-[2] py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 border-none"
            style={{
              background: `linear-gradient(135deg, #FF9E7A 0%, ${CORAL} 100%)`,
              boxShadow:  `0 8px 20px -6px ${CORAL}88`,
            }}
          >
            {isProcessing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              : isCheckingAvailability
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking availability...</>
                : "Confirm Booking"}
          </Button>
        )}
      </div>
    </div>
  );
};