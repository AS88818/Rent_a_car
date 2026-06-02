/*
  # Fix email template creation RLS

  The app creates custom email templates from the signed-in user and sets
  created_by = auth.uid(). Older migrations left several possible INSERT
  policy names behind, including policies that checked legacy role locations or
  legacy role names. Replace them with one current policy.
*/

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admin and manager users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can create templates" ON public.email_templates;
DROP POLICY IF EXISTS "Current roles can create email templates" ON public.email_templates;

CREATE POLICY "Current roles can create email templates"
  ON public.email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND COALESCE(is_system_template, false) = false
    AND COALESCE(approval_status::text, 'draft') = 'draft'
    AND ((select auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'user')
  );
