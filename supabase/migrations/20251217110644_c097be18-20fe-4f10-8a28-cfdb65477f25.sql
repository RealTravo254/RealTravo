-- Add check-in status tracking to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS checked_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS checked_in_by uuid;