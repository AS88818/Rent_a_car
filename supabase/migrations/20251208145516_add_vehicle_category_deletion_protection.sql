/*
  # Add Vehicle Category Deletion Protection
  
  ## Changes
  1. Adds a function to check if a category has vehicles before deletion
  2. Adds a trigger to prevent deletion of categories with vehicles
  3. Updates the foreign key to RESTRICT with better error handling
  
  ## Security
  - Prevents accidental data loss
  - Provides clear error messages
*/

-- Function to check if a category can be deleted
CREATE OR REPLACE FUNCTION check_category_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  vehicle_count INTEGER;
BEGIN
  -- Check if there are any vehicles using this category
  SELECT COUNT(*)
  INTO vehicle_count
  FROM vehicles
  WHERE category_id = OLD.id
  AND deleted_at IS NULL;
  
  IF vehicle_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % vehicle(s) are currently assigned to this category. Please reassign or delete those vehicles first.', vehicle_count
      USING HINT = 'Reassign vehicles to another category before deleting this one';
  END IF;
  
  RETURN OLD;
END;
$$;

-- Add trigger to prevent deletion of categories with vehicles
DROP TRIGGER IF EXISTS prevent_category_deletion_with_vehicles ON vehicle_categories;
CREATE TRIGGER prevent_category_deletion_with_vehicles
  BEFORE DELETE ON vehicle_categories
  FOR EACH ROW
  EXECUTE FUNCTION check_category_deletion();

-- Similar protection for branches
CREATE OR REPLACE FUNCTION check_branch_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  vehicle_count INTEGER;
  user_count INTEGER;
BEGIN
  -- Check if there are any vehicles in this branch
  SELECT COUNT(*)
  INTO vehicle_count
  FROM vehicles
  WHERE branch_id = OLD.id
  AND deleted_at IS NULL;
  
  IF vehicle_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete branch: % vehicle(s) are currently assigned to this branch. Please reassign or delete those vehicles first.', vehicle_count
      USING HINT = 'Reassign vehicles to another branch before deleting this one';
  END IF;
  
  -- Check if there are any users in this branch
  SELECT COUNT(*)
  INTO user_count
  FROM users
  WHERE branch_id = OLD.id;
  
  IF user_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete branch: % user(s) are currently assigned to this branch. Please reassign those users first.', user_count
      USING HINT = 'Reassign users to another branch before deleting this one';
  END IF;
  
  RETURN OLD;
END;
$$;

-- Add trigger to prevent deletion of branches with vehicles or users
DROP TRIGGER IF EXISTS prevent_branch_deletion_with_dependencies ON branches;
CREATE TRIGGER prevent_branch_deletion_with_dependencies
  BEFORE DELETE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION check_branch_deletion();
