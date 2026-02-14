-- Drop the old check constraint and add updated one with 'combined'
ALTER TABLE public.payouts DROP CONSTRAINT payouts_recipient_type_check;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_recipient_type_check CHECK (recipient_type = ANY (ARRAY['host'::text, 'referrer'::text, 'combined'::text]));