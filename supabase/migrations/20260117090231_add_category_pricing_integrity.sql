/*
  # Add Category-Pricing Data Integrity

  1. Changes
    - Add category_id column to category_pricing table (to link directly to vehicle_categories)
    - Create foreign key constraint to ensure pricing only exists for valid categories
    - Create trigger to auto-create default pricing when new category is added
    - Migrate existing pricing to use category_id references
    
  2. Benefits
    - Pricing table always follows vehicle categories
    - Can't create pricing for non-existent categories
    - New categories automatically get default pricing
    - If category is deleted, pricing is automatically removed (or prevented)
*/

-- Step 1: Add category_id column to category_pricing (nullable for now)
ALTER TABLE category_pricing 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES vehicle_categories(id) ON DELETE CASCADE;

-- Step 2: Populate category_id for existing pricing entries
UPDATE category_pricing cp
SET category_id = vc.id
FROM vehicle_categories vc
WHERE cp.category_name = vc.category_name;

-- Step 3: Make category_id NOT NULL and create unique constraint
ALTER TABLE category_pricing 
ALTER COLUMN category_id SET NOT NULL;

-- Create unique constraint on category_id
ALTER TABLE category_pricing
DROP CONSTRAINT IF EXISTS category_pricing_category_id_key;

ALTER TABLE category_pricing
ADD CONSTRAINT category_pricing_category_id_key UNIQUE (category_id);

-- Step 4: Create function to auto-create pricing for new categories
CREATE OR REPLACE FUNCTION create_default_pricing_for_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default pricing entry for the new category
  INSERT INTO category_pricing (
    category_id,
    category_name,
    off_peak_rate,
    peak_rate,
    self_drive_deposit
  ) VALUES (
    NEW.id,
    NEW.category_name,
    5000,  -- Default off-peak rate
    6000,  -- Default peak rate
    50000  -- Default security deposit
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger to auto-create pricing when category is added
DROP TRIGGER IF EXISTS auto_create_pricing_trigger ON vehicle_categories;

CREATE TRIGGER auto_create_pricing_trigger
  AFTER INSERT ON vehicle_categories
  FOR EACH ROW
  EXECUTE FUNCTION create_default_pricing_for_category();

-- Step 6: Create function to sync category name changes
CREATE OR REPLACE FUNCTION sync_category_name_to_pricing()
RETURNS TRIGGER AS $$
BEGIN
  -- Update category_name in pricing when category name changes
  UPDATE category_pricing
  SET category_name = NEW.category_name
  WHERE category_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger to sync category name changes
DROP TRIGGER IF EXISTS sync_category_name_trigger ON vehicle_categories;

CREATE TRIGGER sync_category_name_trigger
  AFTER UPDATE OF category_name ON vehicle_categories
  FOR EACH ROW
  WHEN (OLD.category_name IS DISTINCT FROM NEW.category_name)
  EXECUTE FUNCTION sync_category_name_to_pricing();
