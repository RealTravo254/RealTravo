-- Create manual_entries table for availability tracking only
CREATE TABLE public.manual_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('trip', 'event', 'hotel', 'adventure', 'adventure_place')),
  guest_name TEXT NOT NULL,
  guest_contact TEXT NOT NULL,
  slots_booked INTEGER NOT NULL DEFAULT 1,
  visit_date DATE,
  entry_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manual_entries ENABLE ROW LEVEL SECURITY;

-- Policies for manual_entries
CREATE POLICY "Hosts can view their item entries"
ON public.manual_entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM hotels WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM adventure_places WHERE id = item_id AND created_by = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Anyone can insert manual entries"
ON public.manual_entries FOR INSERT
WITH CHECK (true);

CREATE POLICY "Hosts can update their item entries"
ON public.manual_entries FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM trips WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM hotels WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM adventure_places WHERE id = item_id AND created_by = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Hosts can delete their item entries"
ON public.manual_entries FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM trips WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM hotels WHERE id = item_id AND created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM adventure_places WHERE id = item_id AND created_by = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_manual_entries_updated_at
BEFORE UPDATE ON public.manual_entries
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Index for fast lookups
CREATE INDEX idx_manual_entries_item_id ON public.manual_entries(item_id);
CREATE INDEX idx_manual_entries_visit_date ON public.manual_entries(visit_date);
CREATE INDEX idx_manual_entries_status ON public.manual_entries(status);