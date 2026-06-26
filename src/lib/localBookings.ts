// Stores bookings made by guests (not logged in) directly on this device.
// These are NOT synced to Supabase — they only exist locally, on this device,
// until the guest logs in (at which point you may want to migrate/clear them).

const STORAGE_KEY = "realtravo_guest_bookings";

export interface LocalBooking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
  visit_date?: string;
  slots_booked?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  host_phone?: string;
  host_email?: string;
}

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const read = (): LocalBooking[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read local bookings:", err);
    return [];
  }
};

const write = (bookings: LocalBooking[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch (err) {
    console.error("Failed to save local bookings:", err);
  }
};

/** Get all bookings stored locally on this device, newest first. */
export const getLocalBookings = (): LocalBooking[] =>
  read().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

/** Save a new guest booking locally. Returns the booking with its generated id. */
export const saveLocalBooking = (
  booking: Omit<LocalBooking, "id" | "created_at"> & { id?: string; created_at?: string }
): LocalBooking => {
  const bookings = read();
  const newBooking: LocalBooking = {
    ...booking,
    id: booking.id || generateId(),
    created_at: booking.created_at || new Date().toISOString(),
  };
  bookings.push(newBooking);
  write(bookings);
  return newBooking;
};

/** Update an existing local booking (e.g. reschedule, cancel). */
export const updateLocalBooking = (id: string, updates: Partial<LocalBooking>): LocalBooking | null => {
  const bookings = read();
  const idx = bookings.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  bookings[idx] = { ...bookings[idx], ...updates };
  write(bookings);
  return bookings[idx];
};

/** Remove a single local booking. */
export const deleteLocalBooking = (id: string) => {
  write(read().filter((b) => b.id !== id));
};

/** Wipe all local bookings (e.g. once a guest logs in and you've migrated them). */
export const clearLocalBookings = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear local bookings:", err);
  }
};