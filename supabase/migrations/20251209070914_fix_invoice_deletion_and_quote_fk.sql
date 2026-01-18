/*
  # Fix Invoice Deletion and Quote Foreign Key Issues

  ## Overview
  This migration fixes two issues preventing invoice and quote deletion:
  1. Adds explicit DELETE policy for invoices
  2. Updates the foreign key constraint on invoices.quote_id to allow quote deletion

  ## Changes

  ### 1. Add DELETE Policy for Invoices
  - Adds explicit DELETE policy for admin users
  - Ensures admins can delete invoices

  ### 2. Update Foreign Key Constraint
  - Drops existing foreign key constraint on invoices.quote_id
  - Recreates it with ON DELETE SET NULL
  - When a quote is deleted, invoice.quote_id becomes NULL instead of blocking deletion
  - Invoices remain in the system for record-keeping

  ## Security
  - Only admin users can delete invoices
  - Foreign key constraint maintains data integrity while allowing deletion
*/

-- Step 1: Add explicit DELETE policy for invoices (admin only)
DO $$
BEGIN
  -- First, try to drop the policy if it exists
  DROP POLICY IF EXISTS "Admin users can delete invoices" ON invoices;
  
  -- Create new DELETE policy
  CREATE POLICY "Admin users can delete invoices"
    ON invoices
    FOR DELETE
    TO authenticated
    USING (
      (auth.jwt()->>'role' = 'admin')
    );
END $$;

-- Step 2: Update the foreign key constraint to allow quote deletion
DO $$
BEGIN
  -- Drop the existing foreign key constraint
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_quote_id_fkey;
  
  -- Recreate with ON DELETE SET NULL
  ALTER TABLE invoices 
    ADD CONSTRAINT invoices_quote_id_fkey 
    FOREIGN KEY (quote_id) 
    REFERENCES quotes(id) 
    ON DELETE SET NULL;
END $$;

-- Add comment explaining the NULL behavior
COMMENT ON COLUMN invoices.quote_id IS 'Reference to original quote. NULL if quote was deleted (invoice kept for records).';
