-- Enable realtime for saved_items table
ALTER TABLE saved_items REPLICA IDENTITY FULL;

-- Add saved_items to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE saved_items;