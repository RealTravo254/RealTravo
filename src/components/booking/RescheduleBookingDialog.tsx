import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInHours, isBefore, startOfDay } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [isEligible, setIsEligible] = useState(true);
  const [eligibilityMessage, setEligibilityMessage] = useState("");
  const [isFixedDate, setIsFixedDate] = useState(false);
  const [isNewSchedule, setIsNewSchedule] = useState(false);

  useEffect(() => {
    if (open) {
      setIsNewSchedule(!booking.visit_date);
      checkEligibility();
      loadWorkingDays();
      loadBookedDates();
    }
  }, [open, booking]);

  const checkEligibility = async () => {
    // Check if booking type is event - events with fixed dates cannot be rescheduled
    if (booking.booking_type === 'event') {
      setIsEligible(false);
      setEligibilityMessage("Events with fixed dates cannot be rescheduled.");
      return;
    }

    // Check if trip is flexible
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

    // Check 48-hour constraint only if there's an existing visit date
    if (booking.visit_date) {
      const bookingDate = new Date(booking.visit_date);
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
      
      if (booking.booking_type === 'trip') {
        const result = await supabase
          .from('trips')
          .select('date')
          .eq('id', booking.item_id)
          .single();
        // Trips don't have days_opened, they have specific dates
        return;
      } else if (booking.booking_type === 'hotel') {
        const result = await supabase
          .from('hotels')
          .select('days_opened')
          .eq('id', booking.item_id)
          .single();
        data = result.data;
      } else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') {
        const result = await supabase
          .from('adventure_places')
          .select('days_opened')
          .eq('id', booking.item_id)
          .single();
        data = result.data;
      } else if (booking.booking_type === 'attraction') {
        // Attractions table doesn't exist - use empty working days
        data = null;
      }
      
      if (data?.days_opened && Array.isArray(data.days_opened)) {
        setWorkingDays(data.days_opened);
      }
    } catch (error) {
      console.error('Error loading working days:', error);
    }
  };

  const loadBookedDates = async () => {
    // Get total capacity
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
    setTotalCapacity(capacity);

    // Get all bookings for this item (excluding cancelled/rejected)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('visit_date, slots_booked')
      .eq('item_id', booking.item_id)
      .neq('id', booking.id) // Exclude current booking
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    // Calculate which dates are fully booked
    const bookingsByDate = new Map<string, number>();
    bookings?.forEach(b => {
      if (b.visit_date) {
        const current = bookingsByDate.get(b.visit_date) || 0;
        bookingsByDate.set(b.visit_date, current + (b.slots_booked || 1));
      }
    });

    // Find dates where adding our booking would exceed capacity
    const fullyBooked = new Set<string>();
    bookingsByDate.forEach((booked, date) => {
      if (booked + (booking.slots_booked || 1) > capacity) {
        fullyBooked.add(date);
      }
    });

    setBookedDates(fullyBooked);
  };

  const isDayDisabled = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayName = format(date, 'EEEE');
    
    // Disable past dates
    if (isBefore(date, startOfDay(new Date()))) return true;
    
    // Disable non-working days
    if (workingDays.length > 0 && !workingDays.includes(dayName)) return true;
    
    // Disable fully booked dates
    if (bookedDates.has(dateStr)) return true;
    
    return false;
  };

  const handleReschedule = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    // Verify the new date is valid
    const newDateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE');
    
    if (workingDays.length > 0 && !workingDays.includes(dayName)) {
      toast.error("Selected date is not a working day");
      return;
    }

    if (bookedDates.has(newDateStr)) {
      toast.error("Selected date is fully booked");
      return;
    }

    setLoading(true);
    try {
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update booking with new date
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          visit_date: newDateStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      // Create reschedule log only if it was a reschedule (had previous date)
      if (booking.visit_date) {
        const { error: logError } = await supabase
          .from('reschedule_log')
          .insert({
            booking_id: booking.id,
            user_id: user.id,
            old_date: booking.visit_date,
            new_date: newDateStr
          });

        if (logError) throw logError;
      }

      // Get item name for notification
      let itemName = booking.booking_details.trip_name || 
                     booking.booking_details.event_name || 
                     booking.booking_details.hotel_name ||
                     booking.booking_details.place_name ||
                     'Your booking';

      // Create notification for user
      const notificationMessage = isNewSchedule 
        ? `Your visit date for ${itemName} has been set to ${format(selectedDate, 'PPP')}.`
        : `Your booking for ${itemName} has been successfully moved to ${format(selectedDate, 'PPP')}.`;

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: isNewSchedule ? 'visit_date_set' : 'booking_rescheduled',
        title: isNewSchedule ? 'Visit Date Set' : 'Booking Rescheduled',
        message: notificationMessage,
        data: {
          booking_id: booking.id,
          old_date: booking.visit_date,
          new_date: newDateStr
        }
      });

      // Get item creator and send notification to host
      let creatorId = null;
      if (booking.booking_type === 'trip') {
        const { data } = await supabase.from('trips').select('created_by').eq('id', booking.item_id).single();
        creatorId = data?.created_by;
      } else if (booking.booking_type === 'hotel') {
        const { data } = await supabase.from('hotels').select('created_by').eq('id', booking.item_id).single();
        creatorId = data?.created_by;
      } else if (booking.booking_type === 'adventure' || booking.booking_type === 'adventure_place') {
        const { data } = await supabase.from('adventure_places').select('created_by').eq('id', booking.item_id).single();
        creatorId = data?.created_by;
      } else if (booking.booking_type === 'attraction') {
        // Attractions table doesn't exist - skip
        creatorId = null;
      }

      if (creatorId) {
        const hostMessage = isNewSchedule
          ? `Booking #${booking.id.substring(0, 8)} for ${itemName} has a visit date set to ${format(selectedDate, 'PPP')}.`
          : `Booking #${booking.id.substring(0, 8)} for ${itemName} has been rescheduled to ${format(selectedDate, 'PPP')} by the user.`;

        await supabase.from('notifications').insert({
          user_id: creatorId,
          type: isNewSchedule ? 'visit_date_set_host' : 'booking_rescheduled_host',
          title: isNewSchedule ? 'Visit Date Set' : 'Booking Date Changed',
          message: hostMessage,
          data: {
            booking_id: booking.id,
            old_date: booking.visit_date,
            new_date: newDateStr
          }
        });
      }

      toast.success(isNewSchedule ? "Visit date set successfully" : "Booking rescheduled successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Reschedule error:', error);
      toast.error(error.message || "Failed to update booking");
    } finally {
      setLoading(false);
    }
  };

  // Guard against null booking
  if (!booking) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNewSchedule ? 'Set Visit Date' : 'Reschedule Booking'}</DialogTitle>
          <DialogDescription>
            {isNewSchedule 
              ? 'Select a visit date for your booking. You must schedule at least 48 hours in advance.'
              : 'Select a new date for your booking. Changes must be made at least 48 hours before your scheduled date.'}
          </DialogDescription>
        </DialogHeader>

        {!isEligible ? (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Cannot {isNewSchedule ? 'Schedule' : 'Reschedule'}</p>
              <p className="text-sm text-muted-foreground mt-1">{eligibilityMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              {booking.visit_date && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">Current Date:</span>
                  <span>{format(new Date(booking.visit_date), 'PPP')}</span>
                </div>
              )}
              {selectedDate && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">{isNewSchedule ? 'Selected Date:' : 'New Date:'}</span>
                  <span>{format(selectedDate, 'PPP')}</span>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium mb-3">Select {isNewSchedule ? 'Visit' : 'New'} Date</p>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={isDayDisabled}
                className={cn("pointer-events-auto mx-auto")}
              />
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <p>• Dates in gray are not available (non-working days or fully booked)</p>
                <p>• You must schedule at least 48 hours in advance</p>
                {workingDays.length > 0 && (
                  <p>• Working days: {workingDays.join(', ')}</p>
                )}
              </div>
            </div>

            {selectedDate && (
              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <p className="font-medium">Confirm {isNewSchedule ? 'Visit Date' : 'Reschedule'}</p>
                {booking.visit_date && (
                  <p className="text-sm">
                    From: <span className="font-medium">{format(new Date(booking.visit_date), 'PPP')}</span>
                  </p>
                )}
                <p className="text-sm">
                  {isNewSchedule ? 'Date:' : 'To:'} <span className="font-medium text-primary">{format(selectedDate, 'PPP')}</span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleReschedule} disabled={!selectedDate || loading}>
                {loading ? "Processing..." : (isNewSchedule ? "Confirm Date" : "Confirm Reschedule")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
