/*
  # Add Alert Snoozes Table

  ## Problem
  - Dashboard shows many vehicle health alerts which clutter the page
  - Users need ability to temporarily hide individual alerts

  ## Solution
  Create alert_snoozes table to track user-specific snoozed alerts:
  - Per-user snooze settings (each user has their own snoozes)
  - Fixed 7-day snooze duration
  - Snoozed alerts are completely hidden from dashboard
  - Supports 4 alert types: health_flag, snag, spare_key, driver_allocation
  - Auto-cleanup of expired snoozes

  ## Security
  - RLS enabled - users can only view/manage their own snoozes
  - Auto-delete on user/vehicle/booking deletion (CASCADE)
  - Unique constraint prevents duplicate snoozes
*/

-- ============================================================================
-- Alert Snoozes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_snoozes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('health_flag', 'snag', 'spare_key', 'driver_allocation')),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  snoozed_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Ensure only vehicle_id OR booking_id is set, not both
  CONSTRAINT vehicle_or_booking CHECK (
    (vehicle_id IS NOT NULL AND booking_id IS NULL) OR
    (vehicle_id IS NULL AND booking_id IS NOT NULL)
  ),

  -- Prevent duplicate snoozes for same alert
  UNIQUE(user_id, alert_type, vehicle_id, booking_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index for fetching active snoozes for a user
CREATE INDEX idx_alert_snoozes_user_active
  ON alert_snoozes(user_id, snoozed_until);

-- Index for vehicle-based lookups
CREATE INDEX idx_alert_snoozes_vehicle
  ON alert_snoozes(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- Index for booking-based lookups
CREATE INDEX idx_alert_snoozes_booking
  ON alert_snoozes(booking_id)
  WHERE booking_id IS NOT NULL;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

ALTER TABLE alert_snoozes ENABLE ROW LEVEL SECURITY;

-- Users can view their own snoozes
CREATE POLICY "Users can view their own snoozes"
  ON alert_snoozes FOR SELECT
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Users can create their own snoozes
CREATE POLICY "Users can create their own snoozes"
  ON alert_snoozes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Users can update their own snoozes
CREATE POLICY "Users can update their own snoozes"
  ON alert_snoozes FOR UPDATE
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub')::uuid)
  WITH CHECK (user_id = (auth.jwt() ->> 'sub')::uuid);

-- Users can delete their own snoozes
CREATE POLICY "Users can delete their own snoozes"
  ON alert_snoozes FOR DELETE
  TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE alert_snoozes IS
  'Stores user-specific snoozed dashboard alerts. Snoozes expire after 7 days and are automatically cleaned up.';

COMMENT ON COLUMN alert_snoozes.alert_type IS
  'Type of alert being snoozed: health_flag (grounded vehicles), snag (severe snags), spare_key (missing spare key), driver_allocation (bookings needing driver)';

COMMENT ON COLUMN alert_snoozes.vehicle_id IS
  'Vehicle ID for vehicle-based alerts (health_flag, snag, spare_key). Mutually exclusive with booking_id.';

COMMENT ON COLUMN alert_snoozes.booking_id IS
  'Booking ID for booking-based alerts (driver_allocation). Mutually exclusive with vehicle_id.';

COMMENT ON COLUMN alert_snoozes.snoozed_until IS
  'Timestamp when the snooze expires. Alert will reappear after this time.';
