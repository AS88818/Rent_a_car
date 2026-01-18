/*
  # Fix Security and Performance Issues - Final

  ## Critical Security Fixes
  1. **Enable RLS on users table** - Critical security fix
  2. **Fix RLS policies using user_metadata** - Replace with app_metadata (secure, not user-editable)
  3. **Optimize RLS policy auth calls** - Wrap auth functions in SELECT for better performance
  
  ## Performance Improvements
  4. **Add missing foreign key indexes** - Significantly improves query performance
  
  ## Summary
  - Fixed 70+ RLS policies across all tables
  - Added 9 missing indexes for foreign keys
  - Enabled RLS on users table (critical)
  - Replaced insecure user_metadata with app_metadata
  - Optimized all auth function calls for performance
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_chauffeur_id ON public.bookings(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_approved_by ON public.email_templates(approved_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_pricing_config_updated_by ON public.pricing_config(updated_by);
CREATE INDEX IF NOT EXISTS idx_snag_assignments_assigned_by ON public.snag_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_snags_assigned_to ON public.snags(assigned_to);
CREATE INDEX IF NOT EXISTS idx_snags_deleted_by ON public.snags(deleted_by);
CREATE INDEX IF NOT EXISTS idx_snags_resolution_id ON public.snags(resolution_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);

-- ============================================================================
-- PART 2: ENABLE RLS ON USERS TABLE (CRITICAL SECURITY FIX)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: FIX ALL RLS POLICIES
-- ============================================================================

-- USERS TABLE
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Allow insert during signup" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

CREATE POLICY "Authenticated users can view all users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Allow insert during signup" ON public.users FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Admins can update all users" ON public.users FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY "Admins can delete users" ON public.users FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- BRANCHES TABLE
DROP POLICY IF EXISTS "Everyone can view branches" ON public.branches;
DROP POLICY IF EXISTS "Only admins can create branches" ON public.branches;
DROP POLICY IF EXISTS "Only admins can update branches" ON public.branches;
DROP POLICY IF EXISTS "Only admins can delete branches" ON public.branches;

CREATE POLICY "Everyone can view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can create branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Only admins can update branches" ON public.branches FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Only admins can delete branches" ON public.branches FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- VEHICLE_CATEGORIES TABLE
DROP POLICY IF EXISTS "Everyone can view categories" ON public.vehicle_categories;
DROP POLICY IF EXISTS "Only admins can manage categories" ON public.vehicle_categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON public.vehicle_categories;
DROP POLICY IF EXISTS "Only admins can delete categories" ON public.vehicle_categories;

CREATE POLICY "Everyone can view categories" ON public.vehicle_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage categories" ON public.vehicle_categories FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Only admins can update categories" ON public.vehicle_categories FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Only admins can delete categories" ON public.vehicle_categories FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- VEHICLES TABLE
DROP POLICY IF EXISTS "Admin can view all vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager and staff can view vehicles in their branch" ON public.vehicles;
DROP POLICY IF EXISTS "Admin can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager can insert vehicles in their branch" ON public.vehicles;
DROP POLICY IF EXISTS "Admin can update all vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Manager can update vehicles in their branch" ON public.vehicles;
DROP POLICY IF EXISTS "Admin can delete vehicles" ON public.vehicles;

CREATE POLICY "Admin can view all vehicles" ON public.vehicles FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager and staff can view vehicles in their branch" ON public.vehicles FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager can insert vehicles in their branch" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager' AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can update all vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager can update vehicles in their branch" ON public.vehicles FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager' AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- BOOKINGS TABLE
DROP POLICY IF EXISTS "Admin can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can update all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin can delete bookings" ON public.bookings;

CREATE POLICY "Admin can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can view bookings" ON public.bookings FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff'));
CREATE POLICY "Admin can insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff'));
CREATE POLICY "Admin can update all bookings" ON public.bookings FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can update bookings" ON public.bookings FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff'));
CREATE POLICY "Admin can delete bookings" ON public.bookings FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- MILEAGE_LOGS TABLE
DROP POLICY IF EXISTS "Admin can view all mileage logs" ON public.mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can view mileage logs in their branch" ON public.mileage_logs;
DROP POLICY IF EXISTS "Admin can insert mileage logs" ON public.mileage_logs;
DROP POLICY IF EXISTS "Manager and staff can insert mileage logs in their branch" ON public.mileage_logs;

CREATE POLICY "Admin can view all mileage logs" ON public.mileage_logs FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager and staff can view mileage logs in their branch" ON public.mileage_logs FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can insert mileage logs" ON public.mileage_logs FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager and staff can insert mileage logs in their branch" ON public.mileage_logs FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);

-- MAINTENANCE_LOGS TABLE
DROP POLICY IF EXISTS "Admin can view all maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager and staff can view maintenance for their branch vehicle" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Admin can insert maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager can insert maintenance for their branch vehicles" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Admin can update all maintenance logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Manager can update maintenance for their branch vehicles" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Admin can delete maintenance logs" ON public.maintenance_logs;

CREATE POLICY "Admin can view all maintenance logs" ON public.maintenance_logs FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager and staff can view maintenance for their branch vehicle" ON public.maintenance_logs FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('manager', 'staff') AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can insert maintenance logs" ON public.maintenance_logs FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager can insert maintenance for their branch vehicles" ON public.maintenance_logs FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager' AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can update all maintenance logs" ON public.maintenance_logs FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager can update maintenance for their branch vehicles" ON public.maintenance_logs FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager' AND branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY "Admin can delete maintenance logs" ON public.maintenance_logs FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- SETTINGS TABLE
DROP POLICY IF EXISTS "Everyone can view settings" ON public.settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.settings;

CREATE POLICY "Everyone can view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can update settings" ON public.settings FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- CATEGORY_PRICING TABLE
DROP POLICY IF EXISTS "Everyone can view category pricing" ON public.category_pricing;
DROP POLICY IF EXISTS "Admin can insert category pricing" ON public.category_pricing;
DROP POLICY IF EXISTS "Admin can update category pricing" ON public.category_pricing;
DROP POLICY IF EXISTS "Admin can delete category pricing" ON public.category_pricing;

CREATE POLICY "Everyone can view category pricing" ON public.category_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert category pricing" ON public.category_pricing FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admin can update category pricing" ON public.category_pricing FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admin can delete category pricing" ON public.category_pricing FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- SEASON_RULES TABLE
DROP POLICY IF EXISTS "Everyone can view season rules" ON public.season_rules;
DROP POLICY IF EXISTS "Admin can insert season rules" ON public.season_rules;
DROP POLICY IF EXISTS "Admin can update season rules" ON public.season_rules;
DROP POLICY IF EXISTS "Admin can delete season rules" ON public.season_rules;

CREATE POLICY "Everyone can view season rules" ON public.season_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert season rules" ON public.season_rules FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admin can update season rules" ON public.season_rules FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admin can delete season rules" ON public.season_rules FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- QUOTES TABLE
DROP POLICY IF EXISTS "Admin can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can update all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can view shared quotes" ON public.quotes;

CREATE POLICY "Admin can view all quotes" ON public.quotes FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can view their own quotes" ON public.quotes FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Admin can update all quotes" ON public.quotes FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can update their own quotes" ON public.quotes FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Admin can delete quotes" ON public.quotes FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can delete their own quotes" ON public.quotes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- EMAIL_TEMPLATES TABLE
DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view approved templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view own drafts" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can read email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admin and manager users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can create templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can update any template" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own draft templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can delete custom templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete own custom templates" ON public.email_templates;

CREATE POLICY "Users can view approved templates" ON public.email_templates FOR SELECT TO authenticated USING (approval_status = 'approved' OR created_by = (select auth.uid()));
CREATE POLICY "Users can create templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY "Admins can update any template" ON public.email_templates FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Users can update own draft templates" ON public.email_templates FOR UPDATE TO authenticated USING (created_by = (select auth.uid()) AND approval_status IN ('draft', 'rejected'));
CREATE POLICY "Admins can delete custom templates" ON public.email_templates FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin' AND NOT is_system_template);
CREATE POLICY "Users can delete own custom templates" ON public.email_templates FOR DELETE TO authenticated USING (created_by = (select auth.uid()) AND NOT is_system_template);

-- EMAIL_QUEUE TABLE
DROP POLICY IF EXISTS "Admin and manager users can manage email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Authenticated users can read email queue" ON public.email_queue;

CREATE POLICY "Admin and manager users can manage email queue" ON public.email_queue FOR ALL TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager'));

-- PRICING_CONFIG TABLE
DROP POLICY IF EXISTS "Authenticated users can view pricing config" ON public.pricing_config;
DROP POLICY IF EXISTS "Admin users can update pricing config" ON public.pricing_config;

CREATE POLICY "Authenticated users can view pricing config" ON public.pricing_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin users can update pricing config" ON public.pricing_config FOR ALL TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- INVOICES TABLE
DROP POLICY IF EXISTS "Admin users can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Manager users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Manager users can update invoices" ON public.invoices;

CREATE POLICY "Admin users can manage all invoices" ON public.invoices FOR ALL TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "Manager users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager');
CREATE POLICY "Manager users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'manager');

-- VEHICLE_IMAGES TABLE
DROP POLICY IF EXISTS "Authenticated users can view vehicle images" ON public.vehicle_images;
DROP POLICY IF EXISTS "Authorized users can upload vehicle images" ON public.vehicle_images;
DROP POLICY IF EXISTS "Authorized users can delete vehicle images" ON public.vehicle_images;

CREATE POLICY "Authenticated users can view vehicle images" ON public.vehicle_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized users can upload vehicle images" ON public.vehicle_images FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager'));
CREATE POLICY "Authorized users can delete vehicle images" ON public.vehicle_images FOR DELETE TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager'));

-- USER_CALENDAR_SETTINGS TABLE
DROP POLICY IF EXISTS "Users can view own calendar settings" ON public.user_calendar_settings;
DROP POLICY IF EXISTS "Users can insert own calendar settings" ON public.user_calendar_settings;
DROP POLICY IF EXISTS "Users can update own calendar settings" ON public.user_calendar_settings;
DROP POLICY IF EXISTS "Users can delete own calendar settings" ON public.user_calendar_settings;

CREATE POLICY "Users can view own calendar settings" ON public.user_calendar_settings FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Users can insert own calendar settings" ON public.user_calendar_settings FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update own calendar settings" ON public.user_calendar_settings FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Users can delete own calendar settings" ON public.user_calendar_settings FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- SNAG_ASSIGNMENTS TABLE
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.snag_assignments;
DROP POLICY IF EXISTS "Users can view assignments in their branch" ON public.snag_assignments;
DROP POLICY IF EXISTS "Staff and managers can create assignments" ON public.snag_assignments;
DROP POLICY IF EXISTS "Assigned users can update their assignments" ON public.snag_assignments;

CREATE POLICY "Users can view their own assignments" ON public.snag_assignments FOR SELECT TO authenticated USING (assigned_to = (select auth.uid()));
CREATE POLICY "Users can view assignments in their branch" ON public.snag_assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM snags WHERE snags.id = snag_assignments.snag_id AND snags.branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY "Staff and managers can create assignments" ON public.snag_assignments FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff'));
CREATE POLICY "Assigned users can update their assignments" ON public.snag_assignments FOR UPDATE TO authenticated USING (assigned_to = (select auth.uid()));

-- SNAG_DELETIONS TABLE
DROP POLICY IF EXISTS "Authenticated users can log snag deletions" ON public.snag_deletions;
DROP POLICY IF EXISTS "Admins and managers can view deletion logs" ON public.snag_deletions;

CREATE POLICY "Authenticated users can log snag deletions" ON public.snag_deletions FOR INSERT TO authenticated WITH CHECK (deleted_by = (select auth.uid()));
CREATE POLICY "Admins and managers can view deletion logs" ON public.snag_deletions FOR SELECT TO authenticated USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager'));

-- SNAG_RESOLUTIONS TABLE
DROP POLICY IF EXISTS "Users can view resolutions in their branch" ON public.snag_resolutions;
DROP POLICY IF EXISTS "Staff can create resolutions" ON public.snag_resolutions;

CREATE POLICY "Users can view resolutions in their branch" ON public.snag_resolutions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM snags WHERE snags.id = snag_resolutions.snag_id AND snags.branch_id = ((select auth.jwt()) -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY "Staff can create resolutions" ON public.snag_resolutions FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff'));

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
