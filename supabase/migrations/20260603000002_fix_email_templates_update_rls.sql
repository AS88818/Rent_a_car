/*
  # Fix email template editing RLS

  Admins need to edit approved/system templates from the Emails section.
  Non-admin users can still only edit their own custom draft/rejected templates
  and submit their own drafts for approval.
*/

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and manager users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can update any template" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own draft templates" ON public.email_templates;
DROP POLICY IF EXISTS "Current admins can update any email template" ON public.email_templates;
DROP POLICY IF EXISTS "Current users can update own custom email templates" ON public.email_templates;

CREATE POLICY "Current admins can update any email template"
  ON public.email_templates
  FOR UPDATE
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Current users can update own custom email templates"
  ON public.email_templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    AND COALESCE(is_system_template, false) = false
    AND approval_status::text IN ('draft', 'rejected')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'user'
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND COALESCE(is_system_template, false) = false
    AND approval_status::text IN ('draft', 'rejected', 'pending')
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'user'
  );
