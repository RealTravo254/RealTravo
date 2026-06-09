import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BookingStats {
  [itemId: string]: number;
}

// ── useRealtimeBookings ───────────────────────────────────────────────────────
export const useRealtimeBookings = (itemIds: string[]) => {
  const [bookingStats, setBookingStats] = useState<BookingStats>({});
  const channelId = useRef(`availability-realtime-${Math.random().toString(36).slice(2)}`);
  const idsKey = itemIds.slice().sort().join(',');

  const fetchBookingStats = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const { data: availabilityData, error } = await supabase
      .from('item_availability_overall')
      .select('item_id, booked_slots')
      .in('item_id', ids);

    if (error) {
      console.error('Error fetching availability:', error);
      return;
    }

    const stats: BookingStats = {};
    ids.forEach(id => { stats[id] = 0; });
    availabilityData?.forEach(row => {
      stats[row.item_id] = row.booked_slots || 0;
    });
    setBookingStats(stats);
  }, []);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;

    fetchBookingStats(ids);

    const name = channelId.current;
    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_availability_overall',
        },
        (payload) => {
          const newRecord = payload.new as { item_id: string; booked_slots: number } | null;
          const oldRecord = payload.old as { item_id: string } | null;

          if (payload.eventType === 'DELETE' && oldRecord && ids.includes(oldRecord.item_id)) {
            setBookingStats(prev => ({ ...prev, [oldRecord.item_id]: 0 }));
          } else if (newRecord && ids.includes(newRecord.item_id)) {
            setBookingStats(prev => ({ ...prev, [newRecord.item_id]: newRecord.booked_slots || 0 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [idsKey, fetchBookingStats]);

  return { bookingStats, refetch: () => fetchBookingStats(idsKey ? idsKey.split(',') : []) };
};

// ── useRealtimeItemAvailability ───────────────────────────────────────────────
export const useRealtimeItemAvailability = (itemId: string | undefined, totalCapacity: number) => {
  const [bookedSlots, setBookedSlots] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBookedSlots = useCallback(async () => {
    if (!itemId) {
      setBookedSlots(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('item_availability_overall')
      .select('booked_slots')
      .eq('item_id', itemId)
      .maybeSingle();

    if (error) console.error('Error fetching item availability:', error);

    setBookedSlots(data?.booked_slots || 0);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    fetchBookedSlots();

    if (!itemId) return;

    const channel = supabase
      .channel(`availability-${itemId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_availability_overall',
          filter: `item_id=eq.${itemId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setBookedSlots(0);
          } else {
            const newRecord = payload.new as { booked_slots: number };
            setBookedSlots(newRecord.booked_slots || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId, fetchBookedSlots]);

  const remainingSlots = Math.max(0, totalCapacity - bookedSlots);
  const isSoldOut = totalCapacity > 0 && remainingSlots <= 0;

  return { bookedSlots, remainingSlots, isSoldOut, loading, refetch: fetchBookedSlots };
};

// ── useRealtimeDateAvailability ───────────────────────────────────────────────
export const useRealtimeDateAvailability = (
  itemId: string | undefined,
  visitDate: string | undefined,
  totalCapacity: number,
) => {
  const [bookedSlots, setBookedSlots] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBookedSlots = useCallback(async () => {
    if (!itemId || !visitDate) {
      setBookedSlots(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('item_availability_by_date')
      .select('booked_slots')
      .eq('item_id', itemId)
      .eq('visit_date', visitDate)
      .maybeSingle();

    if (error) console.error('Error fetching date availability:', error);

    setBookedSlots(data?.booked_slots || 0);
    setLoading(false);
  }, [itemId, visitDate]);

  useEffect(() => {
    fetchBookedSlots();

    // FIXED: If itemId or visitDate goes missing, do not subscribe
    if (!itemId || !visitDate) return; 

    // FIXED: Added visitDate to channel name so altering dates drops previous connections cleanly
    const channel = supabase
      .channel(`date-availability-${itemId}-${visitDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_availability_by_date',
          filter: `item_id=eq.${itemId}`,
        },
        (payload) => {
          const newRecord = payload.new as { visit_date: string; booked_slots: number } | null;
          if (newRecord && newRecord.visit_date === visitDate) {
            setBookedSlots(newRecord.booked_slots || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId, visitDate, fetchBookedSlots]); // FIXED: Added visitDate to dependencies

  const remainingSlots = Math.max(0, totalCapacity - bookedSlots);
  const isSoldOut = totalCapacity > 0 && remainingSlots <= 0;

  return { bookedSlots, remainingSlots, isSoldOut, loading, refetch: fetchBookedSlots };
};