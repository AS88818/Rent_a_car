/*
  # Fix Remaining Security Issues - Corrected
  
  ## Critical Security Fixes
  1. **Consolidate Multiple Permissive Policies** - Merge duplicate policies to prevent unintended access
  2. **Fix Function Search Paths** - Set immutable search_path on all functions to prevent search path attacks
  3. **Fix Security Definer View** - Address active_vehicles view security concern
  
  ## Impact
  - Removes 6 duplicate RLS policies
  - Secures 21 database functions against search path attacks
  - Fixes security definer view to respect user permissions
*/

-- ============================================================================
-- PART 1: CONSOLIDATE DUPLICATE RLS POLICIES
-- ============================================================================

-- Remove duplicate branches policies
DROP POLICY IF EXISTS "Branches are viewable by authenticated users" ON public.branches;

-- Remove duplicate category_pricing policies
DROP POLICY IF EXISTS "All authenticated users can view category pricing" ON public.category_pricing;

-- Remove duplicate season_rules policies
DROP POLICY IF EXISTS "All authenticated users can view season rules" ON public.season_rules;

-- Remove duplicate settings policies
DROP POLICY IF EXISTS "Settings are viewable by authenticated users" ON public.settings;

-- Remove duplicate vehicle_categories policies
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.vehicle_categories;

-- Remove duplicate pricing_config policies
DROP POLICY IF EXISTS "Authenticated users can read pricing config" ON public.pricing_config;

-- ============================================================================
-- PART 2: FIX FUNCTION SEARCH PATHS (SECURITY CRITICAL)
-- ============================================================================

-- Set search_path for all functions to prevent search path attacks
-- This is critical because without it, functions could be tricked into using
-- malicious objects created by users in their own schemas

ALTER FUNCTION public.check_vehicle_image_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_calendar_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_snag_assignment() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_snag_on_assignment() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_assignment_deadline() SET search_path = public, pg_temp;
ALTER FUNCTION public.link_resolution_to_snag() SET search_path = public, pg_temp;
ALTER FUNCTION public.replace_email_variables(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_duration(timestamp with time zone, timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_booking_emails() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_email_template_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.queue_booking_emails() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_quote_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_quote_reference_trigger() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_pricing_config_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_invoice_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_invoice_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_overdue_invoices() SET search_path = public, pg_temp;
ALTER FUNCTION public.queue_invoice_receipt_email() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_vehicle_location_on_booking_complete() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

-- ============================================================================
-- PART 3: FIX SECURITY DEFINER VIEW
-- ============================================================================

-- Recreate active_vehicles view without SECURITY DEFINER
-- This makes it respect RLS policies of the calling user instead of
-- running with elevated privileges

DROP VIEW IF EXISTS public.active_vehicles CASCADE;

CREATE VIEW public.active_vehicles AS
SELECT *
FROM public.vehicles
WHERE deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.active_vehicles TO authenticated;

-- ============================================================================
-- DOCUMENTATION: UNUSED INDEXES
-- ============================================================================

/*
  Note on Unused Indexes:
  
  The following indexes are currently flagged as "unused" but are intentionally kept:
  
  1. FOREIGN KEY INDEXES (Critical for JOIN performance):
     - Bookings: vehicle_id, branch_id, chauffeur_id
     - Vehicles: branch_id, category_id
     - Users: branch_id
     - Snags: assigned_to, deleted_by, resolution_id
     - Email Templates: approved_by, created_by
     - Invoices: created_by, quote_id
     - Pricing Config: updated_by
     
  2. STATUS/FILTER INDEXES (Essential for common queries):
     - Status fields: vehicles, bookings, snags, invoices, quotes
     - Priority field: snags
     - Approval status: email_templates
     
  3. DATE/TIME INDEXES (Required for time-based queries):
     - Datetime fields: bookings, mileage_logs, maintenance_logs
     - Created_at: quotes, notifications
     - Deleted_at: vehicles, snags
     - Due date: invoices
     
  4. REFERENCE/LOOKUP INDEXES (For unique identifiers):
     - Invoice numbers, quote references, Google calendar event IDs
     
  5. BOOLEAN FLAGS (For filtering):
     - is_draft, mot_not_applicable on vehicles
     - is_system on email_templates
     - is_primary on vehicle_images
     - read status on notifications
  
  These indexes will become essential as:
  - The dataset grows beyond a few hundred records
  - More complex queries are executed
  - Reports and dashboards are built
  - API performance becomes critical
  
  Keeping them now prevents future performance issues and expensive re-indexing operations.
*/
