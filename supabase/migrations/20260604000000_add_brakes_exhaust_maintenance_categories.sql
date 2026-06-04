-- Expand maintenance log work categories requested by the client.
ALTER TABLE maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_work_cat;

ALTER TABLE maintenance_logs
  ADD CONSTRAINT maintenance_logs_work_cat CHECK (
    work_category IS NULL OR
    work_category IN (
      'Engine / Fuel', 'Gearbox', 'Suspension', 'Electrical', 'Body', 'Accessories',
      'Cooling', 'Service', 'Steering', 'Wheels', 'Brakes', 'Exhaust'
    )
  );
