-- Remove business_accounts table and update RLS policies to allow all authenticated users to create content

-- Drop business_accounts table
DROP TABLE IF EXISTS public.business_accounts CASCADE;

-- Update trips RLS policies - allow all authenticated users to create
DROP POLICY IF EXISTS "Business owners can insert trips" ON public.trips;
DROP POLICY IF EXISTS "Business owners can update their trips" ON public.trips;

CREATE POLICY "Authenticated users can insert trips" 
ON public.trips 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their trips" 
ON public.trips 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Update events RLS policies - allow all authenticated users to create
DROP POLICY IF EXISTS "Business owners can insert events" ON public.events;
DROP POLICY IF EXISTS "Business owners can update their events" ON public.events;

CREATE POLICY "Authenticated users can insert events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their events" 
ON public.events 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Update hotels RLS policies - allow all authenticated users to create
DROP POLICY IF EXISTS "Business owners can insert hotels" ON public.hotels;
DROP POLICY IF EXISTS "Business owners can update their hotels" ON public.hotels;

CREATE POLICY "Authenticated users can insert hotels" 
ON public.hotels 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their hotels" 
ON public.hotels 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Update adventure_places RLS policies - allow all authenticated users to create
DROP POLICY IF EXISTS "Business owners can insert adventure places" ON public.adventure_places;
DROP POLICY IF EXISTS "Business owners can update their adventure places" ON public.adventure_places;

CREATE POLICY "Authenticated users can insert adventure places" 
ON public.adventure_places 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their adventure places" 
ON public.adventure_places 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Remove business role from user_roles enum is not necessary as we keep the enum for backwards compatibility
-- Remove the trigger that creates business roles
DROP TRIGGER IF EXISTS on_business_account_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_business_role();