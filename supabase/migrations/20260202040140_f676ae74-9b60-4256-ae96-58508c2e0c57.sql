-- Update the notification trigger to check for 'completed' instead of 'paid'
CREATE OR REPLACE FUNCTION public.notify_on_booking_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item_name text;
  v_item_creator uuid;
BEGIN
  -- Only process completed payments
  IF NEW.payment_status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get item creator based on booking type
  IF NEW.booking_type = 'trip' THEN
    SELECT name, created_by INTO v_item_name, v_item_creator
    FROM trips WHERE id = NEW.item_id;
  ELSIF NEW.booking_type = 'event' THEN
    SELECT name, created_by INTO v_item_name, v_item_creator
    FROM trips WHERE id = NEW.item_id AND type = 'event';
  ELSIF NEW.booking_type = 'hotel' THEN
    SELECT name, created_by INTO v_item_name, v_item_creator
    FROM hotels WHERE id = NEW.item_id;
  ELSIF NEW.booking_type IN ('adventure', 'adventure_place') THEN
    SELECT name, created_by INTO v_item_name, v_item_creator
    FROM adventure_places WHERE id = NEW.item_id;
  ELSIF NEW.booking_type = 'attraction' THEN
    SELECT local_name, created_by INTO v_item_name, v_item_creator
    FROM attractions WHERE id = NEW.item_id;
  END IF;

  -- Create notification for HOST (item creator)
  IF v_item_creator IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_item_creator,
      'new_booking',
      'New Booking Received',
      'You have received a new booking for ' || COALESCE(v_item_name, 'your listing'),
      jsonb_build_object(
        'booking_id', NEW.id,
        'item_id', NEW.item_id,
        'booking_type', NEW.booking_type,
        'total_amount', NEW.total_amount,
        'guest_name', COALESCE(NEW.guest_name, ''),
        'visit_date', NEW.visit_date
      )
    );
  END IF;

  -- Create notification for USER (if logged in)
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'payment_confirmed',
      'Payment Confirmed',
      'Your payment of KES ' || NEW.total_amount || ' for ' || COALESCE(v_item_name, 'your booking') || ' has been confirmed.',
      jsonb_build_object(
        'booking_id', NEW.id,
        'item_id', NEW.item_id,
        'booking_type', NEW.booking_type,
        'total_amount', NEW.total_amount,
        'visit_date', NEW.visit_date
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Also update the award_referral_commission function to check for 'completed'
CREATE OR REPLACE FUNCTION public.award_referral_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tracking RECORD;
  v_settings RECORD;
  v_service_fee_rate NUMERIC;
  v_commission_rate NUMERIC;
  v_commission_type TEXT;
  v_service_fee_amount NUMERIC;
  v_commission_amount NUMERIC;
  v_existing_commission_count INTEGER;
BEGIN
  -- Only process if payment is completed and referral_tracking_id exists
  IF NEW.payment_status != 'completed' OR NEW.referral_tracking_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- For UPDATE, only process if payment_status changed to completed
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status = NEW.payment_status THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Check if commission already exists for this booking to prevent duplicates
  SELECT COUNT(*) INTO v_existing_commission_count
  FROM public.referral_commissions
  WHERE booking_id = NEW.id;

  IF v_existing_commission_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get referral tracking details
  SELECT * INTO v_tracking
  FROM public.referral_tracking
  WHERE id = NEW.referral_tracking_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get commission settings
  SELECT * INTO v_settings
  FROM public.referral_settings
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine service fee and commission rate based on booking type
  v_commission_type := 'booking';
  
  IF NEW.booking_type = 'trip' THEN
    v_service_fee_rate := v_settings.trip_service_fee;
    v_commission_rate := v_settings.trip_commission_rate;
  ELSIF NEW.booking_type = 'event' THEN
    v_service_fee_rate := v_settings.event_service_fee;
    v_commission_rate := v_settings.event_commission_rate;
  ELSIF NEW.booking_type = 'hotel' THEN
    v_service_fee_rate := v_settings.hotel_service_fee;
    v_commission_rate := v_settings.hotel_commission_rate;
  ELSIF NEW.booking_type = 'attraction' THEN
    v_service_fee_rate := v_settings.attraction_service_fee;
    v_commission_rate := v_settings.attraction_commission_rate;
  ELSIF NEW.booking_type IN ('adventure', 'adventure_place') THEN
    v_service_fee_rate := v_settings.adventure_place_service_fee;
    v_commission_rate := v_settings.adventure_place_commission_rate;
  ELSE
    -- Default fallback
    v_service_fee_rate := 20.0;
    v_commission_rate := 5.0;
  END IF;

  -- Calculate service fee from gross booking amount
  v_service_fee_amount := (NEW.total_amount * v_service_fee_rate) / 100;
  
  -- Calculate commission from service fee using category-specific commission rate
  v_commission_amount := (v_service_fee_amount * v_commission_rate) / 100;

  -- Insert commission record with status 'paid' immediately
  INSERT INTO public.referral_commissions (
    referrer_id,
    referred_user_id,
    booking_id,
    referral_tracking_id,
    commission_type,
    commission_amount,
    commission_rate,
    booking_amount,
    status,
    paid_at
  ) VALUES (
    v_tracking.referrer_id,
    v_tracking.referred_user_id,
    NEW.id,
    NEW.referral_tracking_id,
    v_commission_type,
    v_commission_amount,
    v_commission_rate,
    NEW.total_amount,
    'paid',
    NOW()
  );

  -- Update tracking status to converted
  UPDATE public.referral_tracking
  SET 
    status = 'converted',
    converted_at = NOW()
  WHERE id = NEW.referral_tracking_id;

  RAISE NOTICE 'Referral commission awarded: % for booking %', v_commission_amount, NEW.id;

  RETURN NEW;
END;
$function$;