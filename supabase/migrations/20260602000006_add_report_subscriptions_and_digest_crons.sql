/*
  # Add report subscriptions and scheduled digest jobs

  Adds Feature 3 report subscriptions and allows email_queue rows that are not
  tied to a booking or invoice, specifically for scheduled report emails.
*/

CREATE TABLE IF NOT EXISTS report_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily_ops_digest', 'weekly_finance_brief')),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_report_subscriptions_user_id
  ON report_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_report_subscriptions_report_enabled
  ON report_subscriptions(report_type, enabled);

ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own report subscriptions" ON report_subscriptions;
CREATE POLICY "Users can view own report subscriptions"
  ON report_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all report subscriptions" ON report_subscriptions;
CREATE POLICY "Admins can view all report subscriptions"
  ON report_subscriptions FOR SELECT
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can update own report subscriptions" ON report_subscriptions;
CREATE POLICY "Users can update own report subscriptions"
  ON report_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all report subscriptions" ON report_subscriptions;
CREATE POLICY "Admins can manage all report subscriptions"
  ON report_subscriptions FOR ALL
  TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO report_subscriptions (user_id, report_type, enabled)
SELECT u.id, rt.report_type, (u.role = 'admin')
FROM users u
CROSS JOIN (
  VALUES ('daily_ops_digest'), ('weekly_finance_brief')
) AS rt(report_type)
WHERE u.deleted_at IS NULL
ON CONFLICT (user_id, report_type) DO NOTHING;

CREATE OR REPLACE FUNCTION create_default_report_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO report_subscriptions (user_id, report_type, enabled)
  VALUES
    (NEW.id, 'daily_ops_digest', NEW.role = 'admin'),
    (NEW.id, 'weekly_finance_brief', NEW.role = 'admin')
  ON CONFLICT (user_id, report_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_report_subscriptions_on_user ON users;
CREATE TRIGGER create_default_report_subscriptions_on_user
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_report_subscriptions();

REVOKE EXECUTE ON FUNCTION public.create_default_report_subscriptions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_report_subscriptions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_report_subscriptions() FROM authenticated;

ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS context_type text;

ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS context_id uuid;

ALTER TABLE email_queue
DROP CONSTRAINT IF EXISTS email_queue_reference_check;

ALTER TABLE email_queue
ADD CONSTRAINT email_queue_reference_check
CHECK (
  (
    booking_id IS NOT NULL
    AND invoice_id IS NULL
    AND (context_type IS NULL OR context_type = 'booking')
  )
  OR (
    booking_id IS NULL
    AND invoice_id IS NOT NULL
    AND (context_type IS NULL OR context_type = 'invoice')
  )
  OR (
    booking_id IS NULL
    AND invoice_id IS NULL
    AND context_type = 'report'
  )
);

CREATE INDEX IF NOT EXISTS idx_email_queue_report_context
  ON email_queue(context_type, email_type, scheduled_for)
  WHERE context_type = 'report';

COMMENT ON TABLE report_subscriptions IS 'Per-user scheduled report email subscriptions.';
COMMENT ON COLUMN email_queue.context_type IS 'Optional queue context: booking, invoice, or report.';
COMMENT ON COLUMN email_queue.context_id IS 'Optional context identifier for non-booking/non-invoice queued emails.';

SELECT cron.unschedule('daily-ops-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-ops-digest');

SELECT cron.schedule(
  'daily-ops-digest',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-ops-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('weekly-finance-brief')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-finance-brief');

SELECT cron.schedule(
  'weekly-finance-brief',
  '0 4 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-finance-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
