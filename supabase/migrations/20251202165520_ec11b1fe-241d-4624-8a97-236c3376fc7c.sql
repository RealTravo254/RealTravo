-- Update the notify_on_booking_creation trigger to handle events
CREATE OR REPLACE FUNCTION public.notify_on_booking_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_item_creator uuid;
BEGIN
  -- Only process paid bookings
  IF NEW.payment_status != 'paid' THEN
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
$$;