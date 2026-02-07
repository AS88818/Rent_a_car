/*
  # Enable pg_cron and pg_net for Automated Email Processing

  1. Extensions
    - Enable pg_cron for scheduled job execution
    - Enable pg_net for async HTTP requests from within PostgreSQL

  2. Cron Job
    - Schedule a job to call the process-email-queue edge function every 5 minutes
    - Uses pg_net to make an HTTP POST to the edge function
    - Passes the service role key for authentication

  3. Why
    - Without this, scheduled emails (pickup reminders, dropoff reminders, feedback requests)
      would never be automatically processed
    - The only way they'd send is if someone manually clicks "Process Emails" in the UI
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule process-email-queue to run every 5 minutes
SELECT cron.schedule(
  'process-email-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
