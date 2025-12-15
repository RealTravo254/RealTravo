-- Fix: Remove the flawed RLS policy that exposes guest booking PII to all users
-- The condition "(is_guest_booking AND (payment_phone IS NOT NULL))" allows anyone to read ALL guest bookings

-- First, drop the existing problematic SELECT policy
DROP POLICY IF EXISTS "Creators can view confirmed paid bookings for their items" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Guest users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow guest bookings to be created" ON public.bookings;

-- Create a secure combined SELECT policy
-- Allows: 1) Users to see their own bookings, 2) Admins to see all, 3) Creators to see paid bookings for their items
CREATE POLICY "Secure booking read access" ON public.bookings
FOR SELECT USING (
  -- User can see their own bookings
  auth.uid() = user_id
  OR
  -- Admins can see all bookings
  public.has_role(auth.uid(), 'admin')
  OR
  -- Item creators can see paid bookings for their items
  (payment_status = 'paid' AND (
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = bookings.item_id AND trips.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.hotels WHERE hotels.id = bookings.item_id AND hotels.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.adventure_places WHERE adventure_places.id = bookings.item_id AND adventure_places.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.attractions WHERE attractions.id = bookings.item_id AND attractions.created_by = auth.uid())
  ))
);

-- Recreate INSERT policy for guest bookings (this is fine - allows creating new bookings)
CREATE POLICY "Allow booking creation" ON public.bookings
FOR INSERT WITH CHECK (
  -- Authenticated users can create bookings for themselves
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Guest bookings allowed with required fields
  (user_id IS NULL AND is_guest_booking = true AND guest_name IS NOT NULL AND guest_email IS NOT NULL)
);