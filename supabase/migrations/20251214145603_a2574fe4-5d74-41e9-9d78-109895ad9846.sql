-- Add gallery_images column to attractions table for consistency with other listing types
ALTER TABLE public.attractions 
ADD COLUMN IF NOT EXISTS gallery_images text[] DEFAULT ARRAY[]::text[];