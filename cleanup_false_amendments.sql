-- Remove false amendment entries where old and new values are the same
-- datetime just formatted differently (e.g. T09:00:00 vs T09:00 vs T09)
-- Run in Supabase SQL Editor.

DELETE FROM booking_amendments
WHERE field_changed IN ('start date/time', 'end date/time', 'start_datetime', 'end_datetime')
  AND left(replace(old_value, ' ', 'T'), 16) = left(replace(new_value, ' ', 'T'), 16);
