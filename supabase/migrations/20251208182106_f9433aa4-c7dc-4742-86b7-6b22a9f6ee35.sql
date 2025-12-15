-- Drop the conflicting constraint that requires 'paid' instead of 'completed'
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS valid_payment_status;

-- Also drop payment_status_check which has 'paid' and conflicts
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS payment_status_check;