-- Drop the table with CASCADE to remove dependent triggers
DROP TABLE IF EXISTS public.mpesa_callback_log CASCADE;

-- Drop the reconcile_mpesa_payment function
DROP FUNCTION IF EXISTS public.reconcile_mpesa_payment() CASCADE;