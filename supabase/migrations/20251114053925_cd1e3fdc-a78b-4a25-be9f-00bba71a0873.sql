-- Allow session_id to be nullable for authenticated users
-- This supports secure session management where authenticated users use user_id
-- and session_id is only used for backward compatibility

ALTER TABLE saved_items ALTER COLUMN session_id DROP NOT NULL;

-- Update the RLS policy to work with user_id instead of session_id
DROP POLICY IF EXISTS "Users can view their own saved items" ON saved_items;
DROP POLICY IF EXISTS "Authenticated users can insert their own saved items" ON saved_items;
DROP POLICY IF EXISTS "Users can delete their own saved items" ON saved_items;

CREATE POLICY "Users can view their own saved items"
ON saved_items FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

CREATE POLICY "Authenticated users can insert their own saved items"
ON saved_items FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

CREATE POLICY "Users can delete their own saved items"
ON saved_items FOR DELETE
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);