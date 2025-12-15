-- Allow anonymous users to view payments where user_id is null (guest bookings)
-- This enables guest users to track their payment status via checkout_request_id
CREATE POLICY "Guest users can view their own payments"
ON public.payments
FOR SELECT
USING (user_id IS NULL);