-- Create trigger function to automatically award referral commissions when bookings are created with paid status
CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tracking RECORD;
  v_settings RECORD;
  v_commission_rate NUMERIC;
  v_commission_type TEXT;
  v_commission_amount NUMERIC;
  v_days_since_first INTEGER;
BEGIN
  -- Only process if payment is completed/paid and referral_tracking_id exists
  IF NEW.payment_status NOT IN ('paid', 'completed') OR NEW.referral_tracking_id IS NULL THEN
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

  -- Default to booking commission
  v_commission_rate := v_settings.booking_commission_rate;
  v_commission_type := 'booking';

  -- Check if this is a host referral
  IF v_tracking.referral_type = 'host' AND v_tracking.referred_user_id IS NOT NULL THEN
    -- Check existing commissions for this referrer-referred user pair
    SELECT 
      EXTRACT(DAY FROM (NOW() - MIN(created_at))) INTO v_days_since_first
    FROM public.referral_commissions
    WHERE referrer_id = v_tracking.referrer_id
      AND referred_user_id = v_tracking.referred_user_id
      AND commission_type = 'host';

    -- If no previous commissions or within duration period, use host rate
    IF v_days_since_first IS NULL OR v_days_since_first <= v_settings.host_commission_duration_days THEN
      v_commission_rate := v_settings.host_commission_rate;
      v_commission_type := 'host';
    END IF;
  END IF;

  -- Calculate commission amount
  v_commission_amount := (NEW.total_amount * v_commission_rate) / 100;

  -- Insert commission record
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
$$;

-- Create trigger on bookings table to award commissions
DROP TRIGGER IF EXISTS trigger_award_referral_commission ON public.bookings;
CREATE TRIGGER trigger_award_referral_commission
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.award_referral_commission();