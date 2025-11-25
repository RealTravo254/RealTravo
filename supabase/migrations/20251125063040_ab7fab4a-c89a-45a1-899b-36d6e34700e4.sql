-- Add unique constraint to prevent duplicate reviews
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_user_item_unique UNIQUE (user_id, item_id, item_type);