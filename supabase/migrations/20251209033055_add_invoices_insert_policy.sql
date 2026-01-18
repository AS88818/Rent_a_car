/*
  # Add INSERT policy for invoices table

  1. Changes
    - Add INSERT policy to allow admin and manager users to create invoices
  
  2. Security
    - Only authenticated users with admin or manager roles can create invoices
    - WITH CHECK ensures the role is verified both during insert and after
*/

-- Add INSERT policy for invoices
CREATE POLICY "Authenticated users can create invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'admin')
    OR
    (auth.jwt()->>'role' = 'manager')
  );
