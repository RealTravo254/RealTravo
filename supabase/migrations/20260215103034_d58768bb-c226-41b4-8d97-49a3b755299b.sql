-- Fix referral_tracking INSERT policy: restrict to service_role only
-- The track-referral-click edge function uses service_role to insert
DROP POLICY IF EXISTS "Anyone can insert referral tracking" ON public.referral_tracking;

CREATE POLICY "Service role can insert referral tracking"
ON public.referral_tracking FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);

-- Also ensure referral_commissions old permissive policy is gone
-- (verify the current policy is already service_role only)
-- The "System can insert commissions" was already replaced with service_role check
-- No action needed for commissions as it's already restricted