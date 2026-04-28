-- Add external resolver name to snag_resolutions
-- Used when the snag was fixed by an external party (non-registered user)
ALTER TABLE snag_resolutions ADD COLUMN IF NOT EXISTS resolved_by_external text;
