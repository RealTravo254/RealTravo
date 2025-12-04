-- Update the reconcile_mpesa_payment function to properly handle all scenarios
CREATE OR REPLACE FUNCTION public.reconcile_mpesa_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending_payment RECORD;
  v_booking_id UUID;
  v_result_code TEXT;
  v_mpesa_receipt TEXT;
BEGIN
  v_result_code := NEW.result_code;
  
  -- Find the corresponding pending payment with full details
  SELECT * INTO v_pending_payment
  FROM public.pending_payments
  WHERE checkout_request_id = NEW.checkout_request_id
  LIMIT 1;

  IF v_pending_payment.id IS NULL THEN
    RAISE NOTICE 'No pending payment found for checkout_request_id: %', NEW.checkout_request_id;
    RETURN NEW;
  END IF;

  -- Update the callback log with pending_payment_id reference
  UPDATE public.mpesa_callback_log
  SET pending_payment_id = v_pending_payment.id
  WHERE id = NEW.id;

  -- Extract M-Pesa receipt number from callback metadata if available
  BEGIN
    v_mpesa_receipt := NEW.raw_payload->'Body'->'stkCallback'->'CallbackMetadata'->'Item'->0->>'Value';
  EXCEPTION WHEN OTHERS THEN
    v_mpesa_receipt := NULL;
  END;

  -- Process based on result code using Safaricom Daraja codes
  CASE v_result_code
    -- 0: Transaction completed successfully
    WHEN '0' THEN
      RAISE NOTICE 'Payment SUCCESS (code 0) for checkout: %', NEW.checkout_request_id;
      
      -- Update pending payment to completed
      UPDATE public.pending_payments
      SET 
        payment_status = 'completed',
        result_code = v_result_code,
        result_desc = NEW.result_desc,
        mpesa_receipt_number = v_mpesa_receipt,
        updated_at = now()
      WHERE id = v_pending_payment.id;

      -- Create the booking with PAID status using amount from pending_payments
      INSERT INTO public.bookings (
        user_id,
        item_id,
        booking_type,
        booking_details,
        total_amount,
        payment_status,
        payment_method,
        payment_phone,
        guest_name,
        guest_email,
        guest_phone,
        is_guest_booking,
        visit_date,
        slots_booked,
        referral_tracking_id,
        status
      )
      VALUES (
        (v_pending_payment.booking_data->>'user_id')::UUID,
        (v_pending_payment.booking_data->>'item_id')::UUID,
        v_pending_payment.booking_data->>'booking_type',
        v_pending_payment.booking_data->'booking_details',
        v_pending_payment.amount, -- Use amount from pending_payments table
        'paid',
        'mpesa',
        v_pending_payment.phone_number,
        v_pending_payment.booking_data->>'guest_name',
        v_pending_payment.booking_data->>'guest_email',
        v_pending_payment.booking_data->>'guest_phone',
        COALESCE((v_pending_payment.booking_data->>'is_guest_booking')::BOOLEAN, false),
        (v_pending_payment.booking_data->>'visit_date')::DATE,
        COALESCE((v_pending_payment.booking_data->>'slots_booked')::INTEGER, 1),
        (v_pending_payment.booking_data->>'referral_tracking_id')::UUID,
        'confirmed'
      )
      RETURNING id INTO v_booking_id;

      RAISE NOTICE 'Booking created successfully with ID: %', v_booking_id;

    -- 1: Insufficient balance
    WHEN '1' THEN
      RAISE NOTICE 'Payment FAILED - Insufficient balance (code 1) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Insufficient balance'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 2: Transaction not supported
    WHEN '2' THEN
      RAISE NOTICE 'Payment FAILED - Transaction not supported (code 2) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Transaction type not supported'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 1001: Subscriber busy (user in another USSD session)
    WHEN '1001' THEN
      RAISE NOTICE 'Payment FAILED - Subscriber busy (code 1001) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Unable to process - user busy with another session'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 1032: User cancelled the request
    WHEN '1032' THEN
      RAISE NOTICE 'Payment CANCELLED by user (code 1032) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'cancelled',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Request cancelled by user'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 1037: Timeout (user didn't enter PIN in time)
    WHEN '1037' THEN
      RAISE NOTICE 'Payment TIMEOUT - No response from user (code 1037) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'timeout',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Request timed out - no response from user'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 1025: Wrong PIN entered
    WHEN '1025' THEN
      RAISE NOTICE 'Payment FAILED - Wrong PIN entered (code 1025) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Wrong PIN entered'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- 2001: Invalid initiator details (B2C/B2B)
    WHEN '2001' THEN
      RAISE NOTICE 'Payment FAILED - Invalid initiator (code 2001) for checkout: %', NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = COALESCE(NEW.result_desc, 'Invalid initiator information'),
        updated_at = now()
      WHERE id = v_pending_payment.id;

    -- All other codes: Mark as failed
    ELSE
      RAISE NOTICE 'Payment FAILED with code: % for checkout: %', v_result_code, NEW.checkout_request_id;
      UPDATE public.pending_payments
      SET 
        payment_status = 'failed',
        result_code = v_result_code,
        result_desc = NEW.result_desc,
        updated_at = now()
      WHERE id = v_pending_payment.id;
  END CASE;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_reconcile_mpesa_payment ON public.mpesa_callback_log;
CREATE TRIGGER trigger_reconcile_mpesa_payment
  AFTER INSERT ON public.mpesa_callback_log
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_mpesa_payment();