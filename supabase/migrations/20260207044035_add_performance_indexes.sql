/*
  # Add Performance Indexes on High-Traffic Columns

  1. New Indexes
    - `bookings.status` - filtered on nearly every page load
    - `bookings.client_email` - filtered in booking searches
    - `bookings.booking_reference` - used for unique lookups
    - `bookings.vehicle_id, status` - composite for vehicle booking checks
    - `snags.status` - filtered on snags page and dashboard
    - `snags.vehicle_id, status` - composite for vehicle snag lookups
    - `email_queue.status, scheduled_for` - scanned by queue processor
    - `vehicles.status` - filtered on vehicle lists
    - `vehicles.deleted_at` - soft delete filter used everywhere

  2. Important Notes
    - All indexes use IF NOT EXISTS to be safe for re-runs
    - Composite indexes ordered by selectivity for optimal query plans
*/

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_email ON bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_status ON bookings(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_datetime ON bookings(start_datetime);

CREATE INDEX IF NOT EXISTS idx_snags_status ON snags(status);
CREATE INDEX IF NOT EXISTS idx_snags_vehicle_status ON snags(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_snags_deleted_at ON snags(deleted_at);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_branch_id ON vehicles(branch_id);
