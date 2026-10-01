import { supabase } from "@/integrations/supabase/client";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";

export const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

export interface DateConflict {
  date: string; // yyyy-MM-dd
  left: number; // slots left that day (others already booked)
  needed: number; // slots this booking needs
}

/**
 * Number of days a booking occupies (nights for hotels, days for trips/adventures).
 * Falls back to 1 when nothing is stored.
 */
export function getBookingSpan(details: any): number {
  const n = Number(
    details?.duration_days ?? details?.nights ?? details?.number_of_nights ?? details?.duration ?? 1
  );
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** booked slots per day for an item (ALL bookings, from the public availability table) */
export async function fetchBookedByDate(
  itemId: string,
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("item_availability_by_date")
    .select("visit_date, booked_slots")
    .eq("item_id", itemId)
    .gte("visit_date", dateKey(start))
    .lte("visit_date", dateKey(end));

  if (error) throw error;

  const map = new Map<string, number>();
  data?.forEach((r: any) => {
    map.set(r.visit_date, (map.get(r.visit_date) || 0) + (r.booked_slots || 0));
  });
  return map;
}

/**
 * Remove a booking's own slots from the map (used when rescheduling, so the
 * user's current booking never blocks them).
 */
export function subtractOwnBooking(
  map: Map<string, number>,
  visitDate: string | null,
  span: number,
  slots: number
) {
  if (!visitDate) return map;
  const start = parseISO(visitDate);
  eachDayOfInterval({ start, end: addDays(start, span - 1) }).forEach((d) => {
    const k = dateKey(d);
    if (map.has(k)) map.set(k, Math.max(0, (map.get(k) || 0) - slots));
  });
  return map;
}

/** Every day in [start, end] that cannot take `slots` more bookings. */
export function findConflicts(params: {
  start: Date;
  end: Date;
  booked: Map<string, number>;
  capacity: number;
  slots?: number;
}): DateConflict[] {
  const { start, end, booked, capacity, slots = 1 } = params;
  return eachDayOfInterval({ start, end })
    .map((d) => {
      const k = dateKey(d);
      const left = Math.max(0, capacity - (booked.get(k) || 0));
      return { date: k, left, needed: slots };
    })
    .filter((c) => c.left < c.needed);
}

/** Fresh DB check across the whole range (handles ranges that cross months). */
export async function checkRangeAvailability(params: {
  itemId: string;
  start: Date;
  end: Date;
  capacity: number;
  slots?: number;
}): Promise<{ available: boolean; conflicts: DateConflict[] }> {
  const booked = await fetchBookedByDate(params.itemId, params.start, params.end);
  const conflicts = findConflicts({ ...params, booked });
  return { available: conflicts.length === 0, conflicts };
}

// ───────────────────────── Facility date ranges ─────────────────────────
// Facilities (e.g. CONFERENCE 22 Sep -> 23 Sep) live inside bookings.booking_details,
// so they are checked through the get_facility_booked_dates SQL function.

export interface FacilityRange {
  name: string;
  startDate: string; // yyyy-MM-dd
  endDate?: string; // yyyy-MM-dd
  [key: string]: any;
}

export interface FacilityConflict {
  facility: string;
  date: string; // yyyy-MM-dd
}

/** Checks every day of every facility range against OTHER people's bookings. */
export async function checkFacilityRanges(
  itemId: string,
  facilities: FacilityRange[],
  excludeBookingId?: string
): Promise<{ available: boolean; conflicts: FacilityConflict[] }> {
  const conflicts: FacilityConflict[] = [];

  await Promise.all(
    (facilities || []).map(async (f) => {
      if (!f.startDate) return;
      const { data, error } = await (supabase as any).rpc("get_facility_booked_dates", {
        p_item_id: itemId,
        p_facility_name: f.name,
        p_start: f.startDate,
        p_end: f.endDate || f.startDate,
        p_exclude_booking_id: excludeBookingId ?? null,
      });
      if (error) throw error;
      (data || []).forEach((row: any) =>
        conflicts.push({ facility: f.name, date: row.booked_date })
      );
    })
  );

  conflicts.sort((a, b) => a.date.localeCompare(b.date));
  return { available: conflicts.length === 0, conflicts };
}

/** Move facility ranges by the same number of days as the rescheduled visit date. */
export function shiftFacilityRanges(facilities: FacilityRange[], deltaDays: number): FacilityRange[] {
  return (facilities || []).map((f) => ({
    ...f,
    startDate: f.startDate ? dateKey(addDays(parseISO(f.startDate), deltaDays)) : f.startDate,
    endDate: f.endDate ? dateKey(addDays(parseISO(f.endDate), deltaDays)) : f.endDate,
  }));
}