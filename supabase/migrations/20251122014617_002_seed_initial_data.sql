/*
  # Seed Initial Data

  1. New Data
    - Insert Nairobi and Nanyuki branches
    - Insert initial vehicle categories: Van, Truck, Car, SUV
*/

INSERT INTO branches (branch_name, location, contact_info) VALUES
  ('Nairobi Branch', 'Nairobi, Kenya', '+254 701 000 001'),
  ('Nanyuki Branch', 'Nanyuki, Kenya', '+254 701 000 002')
ON CONFLICT (branch_name) DO NOTHING;

INSERT INTO vehicle_categories (category_name, description) VALUES
  ('Van', 'Medium-sized commercial van for goods transport'),
  ('Truck', 'Large truck for heavy load transport'),
  ('Car', 'Sedan or compact car for light transport'),
  ('SUV', 'Sports Utility Vehicle for rough terrain')
ON CONFLICT (category_name) DO NOTHING;