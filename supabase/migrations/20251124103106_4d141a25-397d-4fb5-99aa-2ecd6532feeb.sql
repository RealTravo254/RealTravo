-- Remove admin_notes column from tables
ALTER TABLE trips DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE hotels DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE adventure_places DROP COLUMN IF EXISTS admin_notes;