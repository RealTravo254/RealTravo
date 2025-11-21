-- Add availability tracking to hotels and adventure_places
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS available_rooms integer DEFAULT 10;
ALTER TABLE adventure_places ADD COLUMN IF NOT EXISTS available_slots integer DEFAULT 20;

-- Add comments for clarity
COMMENT ON COLUMN hotels.available_rooms IS 'Total number of rooms/slots available for booking';
COMMENT ON COLUMN adventure_places.available_slots IS 'Total number of slots available for booking';

-- Create a function to get availability for a specific date and item
CREATE OR REPLACE FUNCTION get_date_availability(
  p_item_id uuid,
  p_item_type text,
  p_date date
) RETURNS jsonb AS $$
DECLARE
  v_total_capacity integer;
  v_booked_slots integer;
  v_availability jsonb;
BEGIN
  -- Get total capacity based on item type
  IF p_item_type = 'trip' THEN
    SELECT available_tickets INTO v_total_capacity
    FROM trips
    WHERE id = p_item_id;
  ELSIF p_item_type = 'hotel' THEN
    SELECT available_rooms INTO v_total_capacity
    FROM hotels
    WHERE id = p_item_id;
  ELSIF p_item_type IN ('adventure', 'adventure_place') THEN
    SELECT available_slots INTO v_total_capacity
    FROM adventure_places
    WHERE id = p_item_id;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid item type');
  END IF;

  -- Get booked slots for this date
  SELECT COALESCE(SUM(slots_booked), 0) INTO v_booked_slots
  FROM bookings
  WHERE item_id = p_item_id
    AND visit_date = p_date
    AND status NOT IN ('cancelled', 'rejected');

  -- Calculate availability
  v_availability := jsonb_build_object(
    'total_capacity', v_total_capacity,
    'booked_slots', v_booked_slots,
    'available_slots', GREATEST(0, v_total_capacity - v_booked_slots),
    'availability_status', 
      CASE 
        WHEN v_total_capacity - v_booked_slots <= 0 THEN 'fully_booked'
        WHEN v_booked_slots::float / v_total_capacity > 0.7 THEN 'partially_booked'
        ELSE 'available'
      END
  );

  RETURN v_availability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;