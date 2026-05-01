
-- Add event certificate URL to trips (for event hosting proof)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS event_certificate_url text;

-- Add TRA license URL to adventure_places, hotels, companies
ALTER TABLE public.adventure_places ADD COLUMN IF NOT EXISTS tra_license_url text;
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS tra_license_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tra_license_url text;

-- Add is_banned to profiles for admin ban/unban
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

-- Allow admins to update any profile (for banning)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
