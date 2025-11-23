-- Fix RLS policies for adventure_places and attractions to include WITH CHECK clause

-- Drop existing UPDATE policies for adventure_places
DROP POLICY IF EXISTS "Admins can update all adventure places" ON adventure_places;
DROP POLICY IF EXISTS "Allowed admins can update adventure places" ON adventure_places;
DROP POLICY IF EXISTS "Creators can update their adventure places" ON adventure_places;

-- Create new UPDATE policies with WITH CHECK for adventure_places
CREATE POLICY "Admins can update all adventure places" 
ON adventure_places 
FOR UPDATE 
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Allowed admins can update adventure places" 
ON adventure_places 
FOR UPDATE 
TO public
USING (
  (auth.uid() = created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  ((SELECT email FROM auth.users WHERE id = auth.uid())::text = ANY (allowed_admin_emails))
)
WITH CHECK (
  (auth.uid() = created_by) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  ((SELECT email FROM auth.users WHERE id = auth.uid())::text = ANY (allowed_admin_emails))
);

CREATE POLICY "Creators can update their adventure places" 
ON adventure_places 
FOR UPDATE 
TO public
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Drop existing UPDATE policies for attractions
DROP POLICY IF EXISTS "Admins can update all attractions" ON attractions;
DROP POLICY IF EXISTS "Creators can update their own attractions" ON attractions;

-- Create new UPDATE policies with WITH CHECK for attractions
CREATE POLICY "Admins can update all attractions" 
ON attractions 
FOR UPDATE 
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators can update their own attractions" 
ON attractions 
FOR UPDATE 
TO public
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);