import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface AvailabilityData {
  date: Date;
  status: 'available' | 'partially_booked' | 'fully_booked';
  availableSlots: number;
  totalCapacity: number;
}

interface AvailabilityCalendarProps {
  itemId: string;
  itemType: 'trip' | 'hotel' | 'adventure';
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export function AvailabilityCalendar({ 
  itemId, 
  itemType, 
  onDateSelect,
  selectedDate 
}: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<Map<string, AvailabilityData>>(new Map());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAvailability();
  }, [itemId, itemType, currentMonth]);

  const loadAvailability = async () => {
    setIsLoading(true);
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const availabilityMap = new Map<string, AvailabilityData>();

    // Get total capacity
    let totalCapacity = 0;
    if (itemType === 'trip') {
      const { data: trip } = await supabase
        .from('trips')
        .select('available_tickets')
        .eq('id', itemId)
        .single();
      totalCapacity = trip?.available_tickets || 0;
    } else if (itemType === 'hotel') {
      const { data: hotel } = await supabase
        .from('hotels')
        .select('available_rooms')
        .eq('id', itemId)
        .single();
      totalCapacity = hotel?.available_rooms || 0;
    } else if (itemType === 'adventure') {
      const { data: adventure } = await supabase
        .from('adventure_places')
        .select('available_slots')
        .eq('id', itemId)
        .single();
      totalCapacity = adventure?.available_slots || 0;
    }

    // Get bookings for the month
    const { data: bookings } = await supabase
      .from('bookings')
      .select('visit_date, slots_booked')
      .eq('item_id', itemId)
      .gte('visit_date', format(start, 'yyyy-MM-dd'))
      .lte('visit_date', format(end, 'yyyy-MM-dd'))
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    // Calculate availability for each day
    const bookingsByDate = new Map<string, number>();
    bookings?.forEach(booking => {
      if (booking.visit_date) {
        const dateKey = booking.visit_date;
        const current = bookingsByDate.get(dateKey) || 0;
        bookingsByDate.set(dateKey, current + (booking.slots_booked || 1));
      }
    });

    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const bookedSlots = bookingsByDate.get(dateKey) || 0;
      const availableSlots = Math.max(0, totalCapacity - bookedSlots);
      
      let status: 'available' | 'partially_booked' | 'fully_booked' = 'available';
      if (availableSlots === 0) {
        status = 'fully_booked';
      } else if (bookedSlots / totalCapacity > 0.7) {
        status = 'partially_booked';
      }

      availabilityMap.set(dateKey, {
        date: day,
        status,
        availableSlots,
        totalCapacity
      });
    });

    setAvailability(availabilityMap);
    setIsLoading(false);
  };

  const getDateAvailability = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return availability.get(dateKey);
  };

  const modifiers = {
    available: (date: Date) => {
      const avail = getDateAvailability(date);
      return avail?.status === 'available';
    },
    partiallyBooked: (date: Date) => {
      const avail = getDateAvailability(date);
      return avail?.status === 'partially_booked';
    },
    fullyBooked: (date: Date) => {
      const avail = getDateAvailability(date);
      return avail?.status === 'fully_booked';
    }
  };

  const modifiersStyles = {
    available: {
      backgroundColor: 'hsl(var(--success) / 0.2)',
      color: 'hsl(var(--success-foreground))'
    },
    partiallyBooked: {
      backgroundColor: 'hsl(var(--warning) / 0.2)',
      color: 'hsl(var(--warning-foreground))'
    },
    fullyBooked: {
      backgroundColor: 'hsl(var(--destructive) / 0.2)',
      color: 'hsl(var(--destructive-foreground))'
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Availability Calendar</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--success) / 0.2)' }} />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--warning) / 0.2)' }} />
              <span>Limited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--destructive) / 0.2)' }} />
              <span>Fully Booked</span>
            </div>
          </div>
        </div>
        
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              const avail = getDateAvailability(date);
              if (avail?.status !== 'fully_booked') {
                onDateSelect?.(date);
              }
            }
          }}
          onMonthChange={setCurrentMonth}
          disabled={(date) => {
            const avail = getDateAvailability(date);
            return date < new Date() || avail?.status === 'fully_booked';
          }}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="pointer-events-auto"
        />

        {selectedDate && (
          <div className="pt-4 border-t">
            <p className="text-sm">
              <span className="font-semibold">Selected Date:</span> {format(selectedDate, 'PPP')}
            </p>
            {(() => {
              const avail = getDateAvailability(selectedDate);
              if (avail) {
                return (
                  <p className="text-sm text-muted-foreground">
                    {avail.availableSlots} of {avail.totalCapacity} slots available
                  </p>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </Card>
  );
}
