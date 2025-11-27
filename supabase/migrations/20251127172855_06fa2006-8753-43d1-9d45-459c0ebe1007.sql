-- First, update any invalid payment_status values in bookings table to 'pending'
UPDATE bookings 
SET payment_status = 'pending' 
WHERE payment_status NOT IN ('pending', 'paid', 'failed', 'refunded') 
  OR payment_status IS NULL;

-- Update any invalid payment_status values in pending_payments table
UPDATE pending_payments 
SET payment_status = 'pending' 
WHERE payment_status NOT IN ('pending', 'completed', 'failed') 
  OR payment_status IS NULL;

-- Ensure payment_status column has proper constraints in bookings table
ALTER TABLE bookings 
  ALTER COLUMN payment_status SET DEFAULT 'pending';

-- Add check constraint for valid payment statuses in bookings
ALTER TABLE bookings 
  ADD CONSTRAINT valid_payment_status 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- Add check constraint for valid payment statuses in pending_payments
ALTER TABLE pending_payments 
  ADD CONSTRAINT valid_pending_payment_status 
  CHECK (payment_status IN ('pending', 'completed', 'failed'));

-- Create indexes for faster payment status queries
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status 
  ON bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_pending_payments_phone_status 
  ON pending_payments(phone_number, payment_status);

CREATE INDEX IF NOT EXISTS idx_pending_payments_checkout_request 
  ON pending_payments(checkout_request_id);

-- Ensure proper RLS for guest bookings viewing their payment history
DROP POLICY IF EXISTS "Users can view their pending payments" ON pending_payments;
CREATE POLICY "Users can view their pending payments"
  ON pending_payments
  FOR SELECT
  USING (true);

-- Update bookings RLS to allow viewing by payment phone for guest bookings
DROP POLICY IF EXISTS "Creators can view bookings for their items" ON bookings;
CREATE POLICY "Creators can view bookings for their items"
  ON bookings
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (is_guest_booking AND payment_phone IS NOT NULL)
    OR EXISTS (
      SELECT 1 FROM trips WHERE trips.id = bookings.item_id AND trips.created_by = auth.uid()
      UNION ALL
      SELECT 1 FROM hotels WHERE hotels.id = bookings.item_id AND hotels.created_by = auth.uid()
      UNION ALL
      SELECT 1 FROM adventure_places WHERE adventure_places.id = bookings.item_id AND adventure_places.created_by = auth.uid()
      UNION ALL
      SELECT 1 FROM attractions WHERE attractions.id = bookings.item_id AND attractions.created_by = auth.uid()
    )
  );