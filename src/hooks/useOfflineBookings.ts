import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

const BOOKINGS_CACHE_KEY = 'offline_bookings_cache';
const HOST_BOOKINGS_CACHE_KEY = 'offline_host_bookings_cache';
const OFFLINE_SCANS_KEY = 'offline_qr_scans';

interface CachedBooking {
  id: string;
  booking_type: string;
  total_amount: number;
  booking_details: any;
  payment_status: string;
  status: string;
  created_at: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  slots_booked: number | null;
  visit_date: string | null;
  item_id: string;
  item_name?: string;
}

interface OfflineScan {
  bookingId: string;
  scannedAt: string;
  verified: boolean;
  guestName?: string;
  visitDate?: string;
}

export const useOfflineBookings = () => {
  const isOnline = useOnlineStatus();
  const [cachedBookings, setCachedBookings] = useState<CachedBooking[]>([]);
  const [cachedHostBookings, setCachedHostBookings] = useState<CachedBooking[]>([]);
  const [pendingScans, setPendingScans] = useState<OfflineScan[]>([]);

  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = () => {
    try {
      const bookingsData = localStorage.getItem(BOOKINGS_CACHE_KEY);
      if (bookingsData) {
        setCachedBookings(JSON.parse(bookingsData));
      }

      const hostBookingsData = localStorage.getItem(HOST_BOOKINGS_CACHE_KEY);
      if (hostBookingsData) {
        setCachedHostBookings(JSON.parse(hostBookingsData));
      }

      const scansData = localStorage.getItem(OFFLINE_SCANS_KEY);
      if (scansData) {
        setPendingScans(JSON.parse(scansData));
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  };

  // Cache user bookings
  const cacheBookings = useCallback((bookings: CachedBooking[]) => {
    try {
      localStorage.setItem(BOOKINGS_CACHE_KEY, JSON.stringify(bookings));
      setCachedBookings(bookings);
    } catch (error) {
      console.error('Error caching bookings:', error);
    }
  }, []);

  // Cache host bookings
  const cacheHostBookings = useCallback((bookings: CachedBooking[]) => {
    try {
      localStorage.setItem(HOST_BOOKINGS_CACHE_KEY, JSON.stringify(bookings));
      setCachedHostBookings(bookings);
    } catch (error) {
      console.error('Error caching host bookings:', error);
    }
  }, []);

  // Save offline scan
  const saveOfflineScan = useCallback((scan: OfflineScan) => {
    try {
      const scans = [...pendingScans, scan];
      localStorage.setItem(OFFLINE_SCANS_KEY, JSON.stringify(scans));
      setPendingScans(scans);
    } catch (error) {
      console.error('Error saving offline scan:', error);
    }
  }, [pendingScans]);

  // Clear pending scans after sync
  const clearPendingScans = useCallback(() => {
    localStorage.removeItem(OFFLINE_SCANS_KEY);
    setPendingScans([]);
  }, []);

  // Verify booking from cache (for offline QR scanning)
  const verifyBookingOffline = useCallback((bookingId: string, email: string, visitDate: string) => {
    // Check in cached host bookings
    const booking = cachedHostBookings.find(b => 
      b.id === bookingId && 
      b.guest_email === email
    );

    if (!booking) {
      return { valid: false, error: 'Booking not found in cache' };
    }

    if (booking.payment_status !== 'paid' && booking.payment_status !== 'completed') {
      return { valid: false, error: 'Booking is not paid' };
    }

    return { valid: true, booking };
  }, [cachedHostBookings]);

  // Get pending offline check-ins
  const getPendingCheckIns = useCallback(() => {
    try {
      const data = localStorage.getItem('offline_checkins');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }, []);

  // Clear synced check-ins
  const clearSyncedCheckIns = useCallback(() => {
    localStorage.removeItem('offline_checkins');
  }, []);

  return {
    isOnline,
    cachedBookings,
    cachedHostBookings,
    pendingScans,
    cacheBookings,
    cacheHostBookings,
    saveOfflineScan,
    clearPendingScans,
    verifyBookingOffline,
    getPendingCheckIns,
    clearSyncedCheckIns,
  };
};
