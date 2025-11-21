-- Update RLS policies to ensure creators can see their items immediately after creation
-- This applies to hotels, adventure_places, and attractions

-- For hotels - Already has correct policy but let's ensure it's comprehensive
DROP POLICY IF EXISTS "Allow public read access to approved hotels" ON public.hotels;
CREATE POLICY "Allow public read access to approved hotels" 
ON public.hotels 
FOR SELECT 
USING (
  (approval_status = 'approved' AND is_hidden = false) 
  OR (auth.uid() = created_by) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR ((SELECT email FROM auth.users WHERE id = auth.uid())::text = ANY (allowed_admin_emails))
);

-- For adventure_places - Already has correct policy but let's ensure it's comprehensive
DROP POLICY IF EXISTS "Allow public read access to approved adventure_places" ON public.adventure_places;
CREATE POLICY "Allow public read access to approved adventure_places" 
ON public.adventure_places 
FOR SELECT 
USING (
  (approval_status = 'approved' AND is_hidden = false) 
  OR (auth.uid() = created_by) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR ((SELECT email FROM auth.users WHERE id = auth.uid())::text = ANY (allowed_admin_emails))
);

-- For attractions - Update to allow creators to see their own pending items
DROP POLICY IF EXISTS "Public can view approved attractions" ON public.attractions;
CREATE POLICY "Public can view approved attractions" 
ON public.attractions 
FOR SELECT 
USING (
  (approval_status = 'approved' AND is_hidden = false) 
  OR (auth.uid() = created_by) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update bookings table to support adventure_place booking type
-- First, update the check constraint to include all booking types
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check 
CHECK (booking_type IN ('trip', 'hotel', 'adventure_place', 'attraction'));

-- Add missing bookings columns if needed (visit_date should already exist)
-- Ensure booking details can store facilities and activities