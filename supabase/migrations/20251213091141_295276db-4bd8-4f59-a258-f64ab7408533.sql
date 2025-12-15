-- Add latitude and longitude fields to hotels table
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Add latitude and longitude fields to adventure_places table
ALTER TABLE public.adventure_places
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;