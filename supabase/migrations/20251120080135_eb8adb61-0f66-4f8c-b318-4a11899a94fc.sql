-- Create accommodations table
CREATE TABLE public.accommodations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  accommodation_type TEXT NOT NULL,
  custom_type TEXT,
  price NUMERIC NOT NULL,
  number_of_rooms INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 2,
  location TEXT NOT NULL,
  place TEXT NOT NULL,
  country TEXT NOT NULL,
  image_url TEXT NOT NULL,
  images TEXT[] DEFAULT ARRAY[]::text[],
  gallery_images TEXT[] DEFAULT ARRAY[]::text[],
  description TEXT,
  amenities JSONB DEFAULT '[]'::jsonb,
  phone_numbers TEXT[] DEFAULT ARRAY[]::text[],
  email TEXT,
  map_link TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  is_hidden BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accommodations
CREATE POLICY "Allow public read access to approved accommodations"
ON public.accommodations
FOR SELECT
USING (
  (approval_status = 'approved' AND is_hidden = false)
  OR auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can insert accommodations"
ON public.accommodations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their accommodations"
ON public.accommodations
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Admins can update all accommodations"
ON public.accommodations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better query performance
CREATE INDEX idx_accommodations_approval_status ON public.accommodations(approval_status);
CREATE INDEX idx_accommodations_created_by ON public.accommodations(created_by);
CREATE INDEX idx_accommodations_country ON public.accommodations(country);