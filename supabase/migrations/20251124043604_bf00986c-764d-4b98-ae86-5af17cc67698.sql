-- Remove rejection_note and rejection_reason columns from all tables
ALTER TABLE trips DROP COLUMN IF EXISTS rejection_note;
ALTER TABLE hotels DROP COLUMN IF EXISTS rejection_note;
ALTER TABLE adventure_places DROP COLUMN IF EXISTS rejection_note;
ALTER TABLE attractions DROP COLUMN IF EXISTS rejection_note;

-- Ensure admin_notes column exists for internal notes (not rejection reasons)
-- These columns should already exist based on the schema