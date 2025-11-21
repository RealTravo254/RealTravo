-- Enable realtime for bookings table
ALTER TABLE bookings REPLICA IDENTITY FULL;

-- Add bookings to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;