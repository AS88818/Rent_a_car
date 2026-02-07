/*
  # Schedule Daily Vehicle Alerts Generation

  1. Cron Job
    - Schedules generate-vehicle-alerts to run daily at 6:00 AM EAT (3:00 AM UTC)
    - Uses pg_net to make an HTTP POST to the Edge Function
    - Passes the service role key for authentication

  2. Purpose
    - Automatically generates notifications for:
      - MOT expiring/expired
      - Insurance expiring/expired
      - Service due/overdue
      - Grounded vehicles
    - Sends alerts to admin and manager users
    - Prevents duplicate notifications within 24 hours
*/

SELECT cron.schedule(
  'generate-vehicle-alerts-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-vehicle-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
