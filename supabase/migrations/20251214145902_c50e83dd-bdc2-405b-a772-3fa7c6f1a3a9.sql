-- Sync existing photo_urls data to gallery_images column for attractions
UPDATE public.attractions 
SET gallery_images = photo_urls 
WHERE photo_urls IS NOT NULL AND array_length(photo_urls, 1) > 0;