-- Update bookings where payment is completed but booking is still pending
UPDATE public.bookings b
SET payment_status = 'completed', status = 'confirmed', updated_at = now()
FROM public.payments p
WHERE (p.booking_data->>'booking_id')::uuid = b.id
AND p.payment_status = 'completed'
AND b.payment_status = 'pending';