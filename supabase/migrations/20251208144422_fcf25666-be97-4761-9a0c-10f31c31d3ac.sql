-- Drop the mpesa_callback_log table
DROP TABLE IF EXISTS public.mpesa_callback_log;

-- Rename pending_payments to payments
ALTER TABLE public.pending_payments RENAME TO payments;

-- Update payment_status values: 'paid' -> 'completed'
UPDATE public.payments SET payment_status = 'completed' WHERE payment_status = 'paid';

-- Drop old RLS policies on payments (they still reference old table name internally)
DROP POLICY IF EXISTS "Anyone can insert pending payments" ON public.payments;
DROP POLICY IF EXISTS "Service role can update payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own pending payments" ON public.payments;

-- Create new RLS policies for payments table
CREATE POLICY "Anyone can insert payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role and users can update payments" 
ON public.payments 
FOR UPDATE 
USING ((auth.uid() = user_id) OR (auth.uid() = host_id) OR (auth.role() = 'service_role'::text));

CREATE POLICY "Users can view own payments" 
ON public.payments 
FOR SELECT 
USING ((auth.uid() = user_id) OR (auth.uid() = host_id));