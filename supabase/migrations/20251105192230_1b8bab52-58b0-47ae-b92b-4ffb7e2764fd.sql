-- Add registration_number and amenities to hotels table
ALTER TABLE public.hotels 
ADD COLUMN IF NOT EXISTS registration_number text,
ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb;

-- Add registration_number and amenities to adventure_places table
ALTER TABLE public.adventure_places 
ADD COLUMN IF NOT EXISTS registration_number text,
ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb;