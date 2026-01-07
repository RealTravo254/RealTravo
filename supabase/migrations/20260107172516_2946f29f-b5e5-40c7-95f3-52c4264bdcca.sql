-- Add profile_completed field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.profile_completed IS 'Indicates if user has completed their profile (name, phone, email verified)';

-- Update existing profiles to mark as completed if they have name and phone
UPDATE public.profiles 
SET profile_completed = true 
WHERE name IS NOT NULL 
  AND name != '' 
  AND phone_number IS NOT NULL 
  AND phone_number != '';

-- Create function to update profile trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, profile_completed)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    -- Mark as completed only if they have a name (from regular signup)
    CASE 
      WHEN COALESCE(new.raw_user_meta_data ->> 'name', '') != '' THEN true
      ELSE false
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE 
      WHEN profiles.name IS NULL OR profiles.name = '' THEN EXCLUDED.name
      ELSE profiles.name
    END,
    updated_at = now();
  RETURN new;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();