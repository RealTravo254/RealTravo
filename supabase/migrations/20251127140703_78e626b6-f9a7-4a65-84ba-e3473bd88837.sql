-- Enable realtime for pending_payments table
ALTER TABLE public.pending_payments REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_payments;