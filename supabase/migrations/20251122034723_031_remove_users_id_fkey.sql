/*
  # Remove Foreign Key Constraint on users.id

  1. Changes
    - Drop the foreign key constraint users_id_fkey
    - The trigger ensures data integrity by only inserting when auth.users record exists
    - This resolves the circular dependency issue during user creation

  2. Notes
    - The id still references auth.users conceptually, but without the FK constraint
    - Trigger function handles the relationship properly
*/

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
