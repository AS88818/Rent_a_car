/*
  # Temporarily Disable RLS on Vehicles Table

  1. Changes
    - Disable RLS on vehicles table to allow testing
    - This is a temporary measure to diagnose the issue

  2. Security
    - WARNING: This removes all RLS protection temporarily
    - Should be re-enabled after testing
*/

-- Temporarily disable RLS on vehicles table
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
