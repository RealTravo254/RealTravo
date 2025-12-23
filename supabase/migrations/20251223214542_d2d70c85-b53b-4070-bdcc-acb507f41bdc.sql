-- Add 'manual_entry' to payment_method check constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check 
  CHECK (payment_method IN ('mpesa', 'airtel', 'card', 'manual_entry'));

-- Add 'adventure' to booking_type check constraint  
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check 
  CHECK (booking_type IN ('trip', 'event', 'hotel', 'adventure_place', 'attraction', 'adventure'));