-- Add user_id column to saved_items for proper access control
ALTER TABLE public.saved_items 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the overly permissive RLS policies
DROP POLICY IF EXISTS "Allow read access to saved_items" ON public.saved_items;
DROP POLICY IF EXISTS "Allow insert access to saved_items" ON public.saved_items;
DROP POLICY IF EXISTS "Allow delete access to saved_items" ON public.saved_items;

-- Create secure RLS policies that restrict access to the item owner
CREATE POLICY "Users can view their own saved items" 
ON public.saved_items 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
  (auth.uid() IS NULL AND session_id = current_setting('request.headers', true)::json->>'session-id')
);

CREATE POLICY "Authenticated users can insert their own saved items" 
ON public.saved_items 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IS NULL)
);

CREATE POLICY "Users can delete their own saved items" 
ON public.saved_items 
FOR DELETE 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
  (auth.uid() IS NULL AND session_id = current_setting('request.headers', true)::json->>'session-id')
);