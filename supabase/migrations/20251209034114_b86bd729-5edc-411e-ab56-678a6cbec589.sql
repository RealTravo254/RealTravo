-- Drop duplicate/conflicting booking_type constraints
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS booking_type_check;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;

-- Add updated constraint that includes 'event'
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check 
  CHECK (booking_type = ANY (ARRAY['trip'::text, 'event'::text, 'hotel'::text, 'adventure_place'::text, 'attraction'::text]));