-- Fix all SECURITY DEFINER warnings from Supabase security audit.
--
-- Three types of fixes:
-- 1. search_path mutable: ALTER FUNCTION to lock search_path
-- 2. SECURITY DEFINER callable by anon/authenticated: REVOKE FROM PUBLIC
--    (trigger functions still fire via trigger mechanism; pg_cron runs as postgres superuser)
-- 3. record_booking_deposit: switch to SECURITY INVOKER — RLS policies already
--    restrict inserts to admin/manager, so behavior is identical without the elevated privilege

-- ============================================================================
-- 1. Fix search_path on functions recreated in 20260428000002 without it
-- ============================================================================

ALTER FUNCTION public.update_snag_on_assignment() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_snag_assignment() SET search_path = public, pg_temp;

-- ============================================================================
-- 2. Switch record_booking_deposit to SECURITY INVOKER
--    This clears the "authenticated can execute SECURITY DEFINER" warning while
--    preserving functionality — the caller's RLS context applies, and the
--    booking_deposits INSERT policy already requires admin or manager role.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_booking_deposit(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_deposit_amount numeric;
BEGIN
  v_user_id := auth.uid();

  SELECT deposit_amount INTO v_deposit_amount
  FROM bookings
  WHERE id = p_booking_id;

  IF p_amount < v_deposit_amount THEN
    RAISE EXCEPTION 'Payment amount must be at least the deposit amount';
  END IF;

  INSERT INTO booking_deposits (
    booking_id, amount, payment_date, payment_method,
    reference_number, notes, recorded_by
  ) VALUES (
    p_booking_id, p_amount, p_payment_date, p_payment_method,
    p_reference_number, p_notes, v_user_id
  );

  UPDATE bookings
  SET
    deposit_paid = true,
    deposit_payment_date = p_payment_date,
    deposit_payment_method = p_payment_method,
    status = CASE
      WHEN status = 'Deposit Not Paid' THEN 'Active'
      ELSE status
    END
  WHERE id = p_booking_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- 3. Revoke PUBLIC execute from all remaining SECURITY DEFINER functions
--    REVOKE FROM PUBLIC removes the default grant given at CREATE FUNCTION time.
--    Trigger functions still fire via the trigger mechanism regardless.
--    pg_cron runs as the postgres superuser and is not affected by EXECUTE grants.
--    Edge functions that use service_role get an explicit re-grant below.
-- ============================================================================

-- Trigger-only functions
REVOKE EXECUTE ON FUNCTION public.update_snag_on_assignment()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_snag_assignment()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manage_vehicle_booking_status()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_booking_chauffeur_assignment()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_resolution_to_snag()               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_booking_emails()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_invoice_receipt_email()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_booking_emails()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_role()                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_to_jwt()                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_category_name_to_pricing()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_pricing_for_category()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_branch_deletion()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_category_deletion()               FROM PUBLIC;

-- Cron/scheduled functions (pg_cron runs as postgres superuser, unaffected by EXECUTE grants)
REVOKE EXECUTE ON FUNCTION public.auto_complete_overdue_bookings()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_expired_quotes()                 FROM PUBLIC;

-- Edge function (generate-vehicle-alerts runs as service_role — re-grant so it still works)
REVOKE EXECUTE ON FUNCTION public.create_vehicle_alert_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_vehicle_alert_notification(uuid, text, text, text, text, jsonb) TO service_role;

-- get_quote_status is not called from the frontend or any edge function
-- Revoke from PUBLIC and authenticated explicitly (an earlier migration granted it directly to authenticated)
REVOKE EXECUTE ON FUNCTION public.get_quote_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_quote_status(uuid) FROM authenticated;
