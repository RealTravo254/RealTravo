-- Create reviews table for all listing types
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('trip', 'event', 'hotel', 'adventure_place', 'attraction')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, item_id, item_type)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view reviews
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

-- Allow authenticated users to create reviews
CREATE POLICY "Authenticated users can create reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own reviews
CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reviews
CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update adventure_places RLS policies to allow admin updates without restrictions
DROP POLICY IF EXISTS "Admins can update all adventure places" ON public.adventure_places;
CREATE POLICY "Admins can update all adventure places"
ON public.adventure_places
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update hotels RLS policies to allow admin updates without restrictions  
DROP POLICY IF EXISTS "Admins can update all hotels" ON public.hotels;
CREATE POLICY "Admins can update all hotels"
ON public.hotels
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Update attractions RLS policies to allow admin updates without restrictions
DROP POLICY IF EXISTS "Admins can update all attractions" ON public.attractions;
CREATE POLICY "Admins can update all attractions"
ON public.attractions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));