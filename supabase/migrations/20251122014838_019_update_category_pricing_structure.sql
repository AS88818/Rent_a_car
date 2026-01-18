/*
  # Update Category Pricing Structure

  1. Changes
    - Update discount percentages to match the actual pricing bands
    - Update category names to match the spreadsheet
    - Update deposit amounts per category
  
  2. Notes
    - Band discounts are now: 0%, 7%, 27.5%, 35.3%, 59.5%, 74.5%, 49.2%, 62.5%, 69%
    - Categories match the exact spreadsheet categories
*/

-- Clear existing data
TRUNCATE TABLE category_pricing;

-- Update with correct pricing structure
INSERT INTO category_pricing (
  category_name, off_peak_rate, peak_rate, self_drive_deposit,
  tier1_days, tier1_discount,
  tier2_days, tier2_discount,
  tier3_days, tier3_discount,
  tier4_days, tier4_discount,
  tier5_days, tier5_discount,
  tier6_days, tier6_discount,
  tier7_days, tier7_discount,
  tier8_days, tier8_discount,
  tier9_days, tier9_discount
) VALUES
  ('Compact SUV_2DR', 6500, 8000, 50000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Compact SUV_4DR', 7500, 9000, 75000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Single Cab', 8000, 9500, 65000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Double Cab', 9000, 11000, 80000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('MPV', 10000, 12000, 90000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Station Wagon', 11000, 13000, 100000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Mid-Size SUV', 12000, 14500, 110000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Full-Size SUV', 14000, 17000, 130000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69),
  ('Luxury SUV', 18000, 22000, 150000, 3, 0, 7, 0.07, 12, 0.275, 18, 0.353, 25, 0.595, 30, 0.745, 90, 0.492, 180, 0.625, 365, 0.69);