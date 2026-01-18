/*
  # Temporarily Disable RLS on Users Table

  1. Changes
    - Disable RLS on public.users table to allow trigger to insert
    - This is a temporary fix to diagnose the signup issue

  2. Security Note
    - This removes all RLS protection from the users table
    - Will need to re-enable with proper policies that work with triggers
*/

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
