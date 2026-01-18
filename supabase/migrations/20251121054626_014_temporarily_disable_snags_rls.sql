/*
  # Temporarily Disable RLS on Snags Table

  1. Changes
    - Disable RLS on snags table to allow testing
    - This is a temporary measure to diagnose the issue

  2. Security
    - WARNING: This removes all RLS protection temporarily
    - Should be re-enabled after testing
*/

-- Temporarily disable RLS on snags table
ALTER TABLE snags DISABLE ROW LEVEL SECURITY;
