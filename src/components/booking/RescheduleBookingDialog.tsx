import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInHours, differenceInCalendarDays, isBefore, startOfDay, addDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  fetchBookedByDate,
  subtractOwnBooking,
  findConflicts,
  getBookingSpan,
  dateKey,
  DateConflict,
  checkFacilityRanges,
  shiftFacilityRanges,
  FacilityConflict,
  FacilityRange
} from "@/lib/availability";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

interface RescheduleBookingDialogProps {
  booking: {
    id: string;
    item_id: string;
    booking_type: string;
    booking_details: any;
    visit_date: string | null;
    slots_booked: number | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RescheduleBookingDialog({
  booking,
  open,
  onOpenChange,
  onSuccess
}: RescheduleBookingDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  // slots booked by OTHER people per day (this booking's own slots removed)
  const [bookedByOthers, setBookedByOthers] = useState<Map<string, number>>(new Map());
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [isEligible, setIsEligible] = useState(true);
  const [eligibilityMessage, setEligibilityMessage] = useState("");
  const [isFixedDate, setIsFixedDate] = useState(false);
  const [isNewSchedule, setIsNewSchedule] = useState(false);
  const [conflicts, setConflicts] = useState<DateConflict[]>([]);
  const [facilityConflicts, setFacilityConflicts] = useState<FacilityConflict[]>([]);
  const [checkingFacilities, setCheckingFacilities] = useState(false);

  const slotsNeeded = booking?.slots_booked || 1;
  const span = getBookingSpan(booking?.booking_details); // days the booking occupies

  const facilitiesOf = (): FacilityRange[] =>
    (booking?.booking_details?.facilities || booking?.booking_details?.selectedFacilities || []) as FacilityRange[];

  /** Facility dates move by the same number of days as the visit date */
  const shiftedFacilities = (newDate: Date): FacilityRange[] => {
    const delta = booking.visit_date ? differenceInCalendarDays(newDate, parseISO(booking.visit_date)) : 0;
    return shiftFacilityRanges(facilitiesOf(), delta);
  };

  useEffect(() => {
    if (open) {
      setSelectedDate(undefined);
      setConflicts([]);
      setFacilityConflicts([]);
      setIsNewSchedule(!booking.visit_date);
      checkEligibility();
      loadWorkingDays();
      loadBookedDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking]);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const checkEligibility = async () => {
    if (booking.booking_type === 'event') {
      setIsEligible(false);
      setEligibilityMessage("Events with fixed dates cannot be rescheduled.");
      return;
    }

    if (booking.booking_type === 'trip') {
      const { data: trip } = await supabase
        .from('trips')
        .select('is_flexible_date, is_custom_date')
        .eq('id', booking.item_id)
        .single();

      if (!trip?.is_flexible_date && !trip?.is_custom_date) {
        setIsEligible(false);
        setIsFixedDate(true);
        setEligibilityMessage("This trip has a fixed date and cannot be rescheduled.");
        return;
      }
    }

    if (booking.visit_date) {
      const bookingDate = parseISO(booking.visit_date);
      const now = new Date();
      const hoursUntilBooking = differenceInHours(bookingDate, now);

      if (hoursUntilBooking < 48) {
        setIsEligible(false);
        setEligibilityMessage("Bookings cannot be rescheduled within 48 hours of the scheduled date.");
        return;
      }
    }

    setIsEligible(true);
    setEligibilityMessage("");
  };

  const loadWorkingDays = async () => {
    try {
      let data: any = null;
      if (booking.booking_type === 'trip') return;
      else if (booking.booking_type === 'hotel') {
        const result = await supabase.from('hotels').select('days_opened').eq('id', booking.item_id).single();
        data = result.data;
      } else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') {
        const result = await supabase.from('adventure_places').select('days_opened').eq('id', booking.item_id).single();
        data = result.data;
      }

      if (data?.days_opened && Array.isArray(data.days_opened)) {
        setWorkingDays(data.days_opened);
      }
    } catch (error) {
      console.error('Error loading working days:', error);
    }
  };

  const fetchCapacity = async () => {
    let capacity = 0;
    if (booking.booking_type === 'trip') {
      const { data } = await supabase.from('trips').select('available_tickets').eq('id', booking.item_id).single();
      capacity = data?.available_tickets || 0;
    } else if (booking.booking_type === 'hotel') {
      const { data } = await supabase.from('hotels').select('available_rooms').eq('id', booking.item_id).single();
      capacity = data?.available_rooms || 0;
    } else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') {
      const { data } = await supabase.from('adventure_places').select('available_slots').eq('id', booking.item_id).single();
      capacity = data?.available_slots || 0;
    }
    return capacity;
  };

  /**
   * Bookings of everyone else, per day, for [start, end].
   * Uses the public availability table (RLS-safe: the bookings table may only
   * expose the current user's rows) and removes this booking's own slots.
   */
  const fetchOthersBooked = async (start: Date, end: Date) => {
    const map = await fetchBookedByDate(booking.item_id, start, end);
    return subtractOwnBooking(map, booking.visit_date, span, slotsNeeded);
  };

  const loadBookedDates = async () => {
    try {
      const capacity = await fetchCapacity();
      const today = startOfDay(new Date());
      const map = await fetchOthersBooked(addDays(today, -span), addDays(today, 365 + span));
      setBookedByOthers(map);
      setTotalCapacity(capacity);
    } catch (error) {
      console.error('Error loading booked dates:', error);
      toast.error("Could not load availability. Please try again.");
    }
  };

  const isFullDay = (date: Date) => {
    const booked = bookedByOthers.get(dateKey(date)) || 0;
    return totalCapacity - booked < slotsNeeded;
  };

  const isDayDisabled = (date: Date) => {
    const dayName = format(date, 'EEEE');
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (workingDays.length > 0 && !workingDays.includes(dayName)) return true;
    if (isFullDay(date)) return true;
    return false;
  };

  /** Every day from start to start + span - 1 must be free. */
  const getConflicts = (start: Date, booked: Map<string, number>) =>
    findConflicts({
      start,
      end: addDays(start, span - 1),
      booked,
      capacity: totalCapacity,
      slots: slotsNeeded
    });

  const handleSelect = async (date?: Date) => {
    setSelectedDate(date);
    setConflicts(date ? getConflicts(date, bookedByOthers) : []);
    setFacilityConflicts([]);

    // Facilities (e.g. conference 22 -> 23 Sep): every day must be free for the new dates
    if (date && facilitiesOf().length > 0) {
      setCheckingFacilities(true);
      try {
        const result = await checkFacilityRanges(booking.item_id, shiftedFacilities(date), booking.id);
        setFacilityConflicts(result.conflicts);
      } catch (e) {
        console.error('Facility check failed:', e);
      } finally {
        setCheckingFacilities(false);
      }
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    const newDateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE');

    if (workingDays.length > 0 && !workingDays.includes(dayName)) {
      toast.error("Selected date is not a working day");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fresh re-check right before saving (someone may have booked in the meantime)
      const capacity = await fetchCapacity();
      const fresh = await fetchOthersBooked(selectedDate, addDays(selectedDate, span - 1));
      const freshConflicts = findConflicts({
        start: selectedDate,
        end: addDays(selectedDate, span - 1),
        booked: fresh,
        capacity,
        slots: slotsNeeded
      });

      if (freshConflicts.length > 0) {
        setConflicts(freshConflicts);
        setTotalCapacity(capacity);
        toast.error("Some of those days were just booked by someone else.");
        loadBookedDates();
        return;
      }

      // Fresh facility check right before saving
      const newFacilities = shiftedFacilities(selectedDate);
      if (newFacilities.length > 0) {
        const facilityResult = await checkFacilityRanges(booking.item_id, newFacilities, booking.id);
        if (!facilityResult.available) {
          setFacilityConflicts(facilityResult.conflicts);
          toast.error("A facility is already booked on some of those days.");
          return;
        }
      }

      const newDetails: any = { ...booking.booking_details, visit_date: newDateStr };
      if (booking.booking_details?.facilities) newDetails.facilities = newFacilities;
      if (booking.booking_details?.selectedFacilities) newDetails.selectedFacilities = newFacilities;

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          visit_date: newDateStr,
          booking_details: newDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      if (booking.visit_date) {
        await supabase.from('reschedule_log').insert({
          booking_id: booking.id,
          user_id: user.id,
          old_date: booking.visit_date,
          new_date: newDateStr
        });
      }

      let itemName = booking.booking_details.trip_name ||
        booking.booking_details.event_name ||
        booking.booking_details.hotel_name ||
        booking.booking_details.place_name ||
        'Your booking';

      const notificationMessage = isNewSchedule
        ? `Your visit date for ${itemName} has been set to ${format(selectedDate, 'PPP')}.`
        : `Your booking for ${itemName} has been moved to ${format(selectedDate, 'PPP')}.`;

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: isNewSchedule ? 'visit_date_set' : 'booking_rescheduled',
        title: isNewSchedule ? 'Visit Date Set' : 'Booking Rescheduled',
        message: notificationMessage,
        data: { booking_id: booking.id, old_date: booking.visit_date, new_date: newDateStr }
      });

      toast.success(isNewSchedule ? "Visit date set successfully" : "Booking rescheduled successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update booking");
    } finally {
      setLoading(false);
    }
  };

  if (!booking || !open) return null;

  const conflictKeys = new Set(conflicts.map(c => c.date));
  const selectedEnd = selectedDate ? addDays(selectedDate, span - 1) : undefined;

  const modifiers = {
    fullyBooked: (date: Date) => totalCapacity > 0 && isFullDay(date),
    conflict: (date: Date) => conflictKeys.has(dateKey(date)),
    inSpan: (date: Date) => !!selectedDate && !!selectedEnd && date > selectedDate && date <= selectedEnd
  };

  const modifiersStyles = {
    fullyBooked: { color: '#cbd5e1', textDecoration: 'line-through' },
    conflict: { color: '#fff', backgroundColor: '#ef4444', borderRadius: 12, textDecoration: 'none' },
    inSpan: { backgroundColor: `${COLORS.TEAL}20`, borderRadius: 12 }
  };

  // ── Render via portal directly on document.body so it always sits above the
  //    Sheet (z-[260]). The Dialog primitive's own portal targets document.body
  //    but Radix re-parents it inside the SheetContent DOM node in some versions,
  //    which means it inherits the Sheet's stacking context. Using our own portal
  //    ensures we are always a top-level stacking context.
  return createPortal(
    // Backdrop
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex: 400, pointerEvents: "all", touchAction: "none" }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onOpenChange(false); }}
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      {/* Dim overlay — also blocks touches */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ pointerEvents: "all", touchAction: "none" }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => { e.stopPropagation(); onOpenChange(false); }}
        onClick={() => onOpenChange(false)}
      />

      {/* Modal panel — slides up from bottom on mobile, centered on desktop */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col"
        style={{
          maxHeight: "92dvh",
          pointerEvents: "all",
          touchAction: "pan-y",
          zIndex: 401,
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 shrink-0">
          <div>
            <h2
              className="text-xl font-black uppercase tracking-tight"
              style={{ color: COLORS.TEAL }}
            >
              {isNewSchedule ? 'Set Visit Date' : 'Reschedule Booking'}
            </h2>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
              {isNewSchedule
                ? 'Select a visit date. At least 48 hours in advance.'
                : 'Move your booking to a new date.'}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 ml-3"
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 space-y-4">
          {!isEligible ? (
            <div className="flex items-start gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
              <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-black text-red-600 uppercase text-xs tracking-widest">Action Restricted</p>
                <p className="text-sm text-red-500/80 leading-relaxed mt-1 font-bold">{eligibilityMessage}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Current / Selected date pills */}
              <div className="grid grid-cols-2 gap-3">
                {booking.visit_date && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Date</p>
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-black text-slate-600 truncate">
                        {format(parseISO(booking.visit_date), 'dd MMM yyyy')}
                        {span > 1 && ` → ${format(addDays(parseISO(booking.visit_date), span - 1), 'dd MMM')}`}
                      </span>
                    </div>
                  </div>
                )}
                {selectedDate && (
                  <div
                    className="p-3 rounded-2xl border"
                    style={{ backgroundColor: `${COLORS.TEAL}10`, borderColor: `${COLORS.TEAL}30` }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: COLORS.TEAL }}>
                      Selected Date
                    </p>
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.TEAL }} />
                      <span className="text-xs font-black truncate" style={{ color: COLORS.TEAL }}>
                        {format(selectedDate, 'dd MMM yyyy')}
                        {span > 1 && selectedEnd && ` → ${format(selectedEnd, 'dd MMM')}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 overflow-x-auto">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleSelect}
                  disabled={isDayDisabled}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  className="mx-auto"
                />
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 text-slate-400" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Policy & Availability</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      48H ADVANCE NOTICE REQUIRED
                    </li>
                    {workingDays.length > 0 && (
                      <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        {workingDays.length} WORKING DAYS PER WEEK
                      </li>
                    )}
                    {span > 1 && (
                      <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        {span} DAYS MUST ALL BE FREE
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Booked-day conflicts */}
              {conflicts.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-black text-red-600 uppercase text-xs tracking-widest">
                      {conflicts.length === 1 ? "Day already booked" : "Days already booked"}
                    </p>
                    <p className="text-xs text-red-500/80 font-bold mt-1">
                      Your {span > 1 ? "stay includes" : "date is"} already booked by someone else, so you can't move here. Pick different dates.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {conflicts.map(c => (
                        <li key={c.date} className="text-[11px] font-black text-red-600 uppercase tracking-tight">
                          {format(parseISO(c.date), 'EEE dd MMM yyyy')} —{" "}
                          {c.left === 0 ? "Fully booked" : `Only ${c.left} left (need ${c.needed})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Facility conflicts */}
              {facilityConflicts.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-black text-red-600 uppercase text-xs tracking-widest">Facility already booked</p>
                    <p className="text-xs text-red-500/80 font-bold mt-1">
                      Someone else has booked these facility days, so you can't move here. Pick different dates.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {facilityConflicts.map(c => (
                        <li key={`${c.facility}-${c.date}`} className="text-[11px] font-black text-red-600 uppercase tracking-tight">
                          {c.facility} — {format(parseISO(c.date), 'EEE dd MMM yyyy')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="flex-1 py-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-50"
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReschedule}
                  disabled={!selectedDate || loading || checkingFacilities || conflicts.length > 0 || facilityConflicts.length > 0}
                  className="flex-[2] py-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
                    boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`,
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent"
                  }}
                >
                  {loading ? "Processing..." : (isNewSchedule ? "Set Visit Date" : "Confirm Move")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}