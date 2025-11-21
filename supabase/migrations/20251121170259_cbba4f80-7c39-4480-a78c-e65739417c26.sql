-- Add custom date support to trips table
ALTER TABLE public.trips 
ADD COLUMN is_custom_date boolean DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.trips.is_custom_date IS 'When true, the date field is ignored and users choose their own visit date during booking';