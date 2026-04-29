-- Drop any existing check constraint on work_category column (whatever name it has)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'maintenance_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%work_category%'
  LOOP
    EXECUTE 'ALTER TABLE maintenance_logs DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE maintenance_logs
  ADD CONSTRAINT maintenance_logs_work_cat CHECK (
    work_category IS NULL OR
    work_category IN (
      'Engine / Fuel', 'Gearbox', 'Suspension', 'Electrical', 'Body', 'Accessories',
      'Cooling', 'Service', 'Steering', 'Wheels'
    )
  );
