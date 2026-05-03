ALTER TABLE public.host_verifications
ADD COLUMN IF NOT EXISTS tra_license_url text;