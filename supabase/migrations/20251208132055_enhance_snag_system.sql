/*
  # Enhance Snag Management System

  ## Overview
  This migration adds comprehensive functionality to the snag management system including:
  - Mechanic assignments with deadlines
  - Deletion audit trail
  - Detailed resolution tracking with maintenance log integration
  - In-app notifications

  ## New Tables

  ### 1. snag_assignments
  Tracks assignment of snags to mechanics/staff members
  - `id` (uuid, primary key)
  - `snag_id` (uuid) - Reference to snag
  - `assigned_to` (uuid) - User who received the assignment
  - `assigned_by` (uuid) - User who made the assignment
  - `assigned_at` (timestamptz) - When assignment was made
  - `deadline` (date) - Deadline for completion
  - `completed_at` (timestamptz) - When assignment was completed
  - `assignment_notes` (text) - Special instructions
  - `status` (text) - unassigned, assigned, completed, overdue

  ### 2. snag_deletions
  Audit log of all deleted snags
  - `id` (uuid, primary key)
  - `snag_id` (uuid) - Original snag ID
  - `vehicle_id` (uuid) - Vehicle reference
  - `priority` (text) - Original priority
  - `description` (text) - Original description
  - `deleted_by` (uuid) - User who deleted it
  - `deleted_at` (timestamptz) - When deleted
  - `deletion_reason` (text) - Why it was deleted
  - `original_data` (jsonb) - Full original snag data

  ### 3. snag_resolutions
  Detailed information about how snags were resolved
  - `id` (uuid, primary key)
  - `snag_id` (uuid) - Reference to snag
  - `resolution_method` (text) - How it was resolved
  - `resolution_notes` (text) - Detailed description
  - `maintenance_log_id` (uuid) - Optional link to maintenance log
  - `resolved_by` (uuid) - User who resolved it
  - `resolved_at` (timestamptz) - When resolved
  - `photo_urls` (text[]) - Before/after photos

  ### 4. notifications
  In-app notification system
  - `id` (uuid, primary key)
  - `user_id` (uuid) - User who receives notification
  - `type` (text) - Type of notification
  - `title` (text) - Notification title
  - `message` (text) - Notification message
  - `link` (text) - Optional link to related resource
  - `read` (boolean) - Whether notification has been read
  - `created_at` (timestamptz) - When created

  ## Table Modifications
  - Add `assigned_to` column to snags table
  - Add `assignment_deadline` column to snags table
  - Add `resolution_id` column to snags table

  ## Security
  - Enable RLS on all new tables
  - Create appropriate policies for each table
  - Add trigger for automatic deletion audit logging
*/

-- =============================================
-- 1. MODIFY EXISTING SNAGS TABLE
-- =============================================

-- Add assignment and resolution tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE snags ADD COLUMN assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'assignment_deadline'
  ) THEN
    ALTER TABLE snags ADD COLUMN assignment_deadline date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snags' AND column_name = 'resolution_id'
  ) THEN
    ALTER TABLE snags ADD COLUMN resolution_id uuid;
  END IF;
END $$;

-- =============================================
-- 2. CREATE SNAG_ASSIGNMENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS snag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_id uuid NOT NULL REFERENCES snags(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  deadline date,
  completed_at timestamptz,
  assignment_notes text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'overdue', 'reassigned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for snag_assignments
CREATE INDEX IF NOT EXISTS idx_snag_assignments_snag_id ON snag_assignments(snag_id);
CREATE INDEX IF NOT EXISTS idx_snag_assignments_assigned_to ON snag_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_snag_assignments_status ON snag_assignments(status);
CREATE INDEX IF NOT EXISTS idx_snag_assignments_deadline ON snag_assignments(deadline);

-- Enable RLS
ALTER TABLE snag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snag_assignments
CREATE POLICY "Users can view assignments in their branch"
  ON snag_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM snags s
      JOIN users u ON u.id = auth.uid()
      WHERE s.id = snag_assignments.snag_id
      AND (s.branch_id = u.branch_id OR u.role = 'admin')
    )
  );

CREATE POLICY "Users can view their own assignments"
  ON snag_assignments FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Staff and managers can create assignments"
  ON snag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Assigned users can update their assignments"
  ON snag_assignments FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid());

-- =============================================
-- 3. CREATE SNAG_DELETIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS snag_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  priority text,
  status text,
  description text NOT NULL,
  date_opened date,
  date_closed date,
  deleted_by uuid NOT NULL REFERENCES users(id),
  deleted_at timestamptz DEFAULT now(),
  deletion_reason text NOT NULL,
  original_data jsonb NOT NULL,
  branch_id uuid NOT NULL
);

-- Indexes for snag_deletions
CREATE INDEX IF NOT EXISTS idx_snag_deletions_vehicle_id ON snag_deletions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_snag_deletions_deleted_by ON snag_deletions(deleted_by);
CREATE INDEX IF NOT EXISTS idx_snag_deletions_deleted_at ON snag_deletions(deleted_at);

-- Enable RLS
ALTER TABLE snag_deletions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snag_deletions
CREATE POLICY "Admins and managers can view deletion logs"
  ON snag_deletions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- =============================================
-- 4. CREATE SNAG_RESOLUTIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS snag_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_id uuid NOT NULL REFERENCES snags(id) ON DELETE CASCADE,
  resolution_method text NOT NULL CHECK (resolution_method IN ('Repaired', 'Replaced Part', 'Third Party Service', 'No Action Needed', 'Other')),
  resolution_notes text NOT NULL,
  maintenance_log_id uuid REFERENCES maintenance_logs(id) ON DELETE SET NULL,
  resolved_by uuid NOT NULL REFERENCES users(id),
  resolved_at timestamptz DEFAULT now(),
  photo_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add foreign key from snags to snag_resolutions
ALTER TABLE snags DROP CONSTRAINT IF EXISTS snags_resolution_id_fkey;
ALTER TABLE snags ADD CONSTRAINT snags_resolution_id_fkey
  FOREIGN KEY (resolution_id) REFERENCES snag_resolutions(id) ON DELETE SET NULL;

-- Indexes for snag_resolutions
CREATE INDEX IF NOT EXISTS idx_snag_resolutions_snag_id ON snag_resolutions(snag_id);
CREATE INDEX IF NOT EXISTS idx_snag_resolutions_maintenance_log_id ON snag_resolutions(maintenance_log_id);
CREATE INDEX IF NOT EXISTS idx_snag_resolutions_resolved_by ON snag_resolutions(resolved_by);

-- Enable RLS
ALTER TABLE snag_resolutions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snag_resolutions
CREATE POLICY "Users can view resolutions in their branch"
  ON snag_resolutions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM snags s
      JOIN users u ON u.id = auth.uid()
      WHERE s.id = snag_resolutions.snag_id
      AND (s.branch_id = u.branch_id OR u.role = 'admin')
    )
  );

CREATE POLICY "Staff can create resolutions"
  ON snag_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager', 'staff')
    )
  );

-- =============================================
-- 5. CREATE NOTIFICATIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('snag_assigned', 'deadline_approaching', 'snag_completed', 'snag_overdue', 'assignment_updated')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- 6. CREATE TRIGGER FUNCTIONS
-- =============================================

-- Function to create notification when snag is assigned
CREATE OR REPLACE FUNCTION notify_snag_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_snag_description text;
  v_vehicle_reg text;
BEGIN
  -- Get snag and vehicle details
  SELECT s.description, v.reg_number INTO v_snag_description, v_vehicle_reg
  FROM snags s
  JOIN vehicles v ON v.id = s.vehicle_id
  WHERE s.id = NEW.snag_id;

  -- Create notification for assigned user
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.assigned_to,
    'snag_assigned',
    'New Snag Assignment',
    'You have been assigned: "' || v_snag_description || '" for vehicle ' || v_vehicle_reg,
    '/snags?vehicle=' || (SELECT vehicle_id FROM snags WHERE id = NEW.snag_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification on assignment
DROP TRIGGER IF EXISTS on_snag_assigned ON snag_assignments;
CREATE TRIGGER on_snag_assigned
  AFTER INSERT ON snag_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'assigned')
  EXECUTE FUNCTION notify_snag_assignment();

-- Function to update snags table when assigned
CREATE OR REPLACE FUNCTION update_snag_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the snag with assignment info
  UPDATE snags
  SET
    assigned_to = NEW.assigned_to,
    assignment_deadline = NEW.deadline
  WHERE id = NEW.snag_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update snag on assignment
DROP TRIGGER IF EXISTS on_assignment_update_snag ON snag_assignments;
CREATE TRIGGER on_assignment_update_snag
  AFTER INSERT ON snag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_snag_on_assignment();

-- Function to update assignment status based on deadline
CREATE OR REPLACE FUNCTION check_assignment_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deadline IS NOT NULL AND NEW.deadline < CURRENT_DATE AND NEW.status = 'assigned' THEN
    NEW.status = 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check deadline on update
DROP TRIGGER IF EXISTS check_deadline_on_update ON snag_assignments;
CREATE TRIGGER check_deadline_on_update
  BEFORE UPDATE ON snag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION check_assignment_deadline();

-- Function to link resolution to snag
CREATE OR REPLACE FUNCTION link_resolution_to_snag()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the snag with resolution ID
  UPDATE snags
  SET resolution_id = NEW.id
  WHERE id = NEW.snag_id;

  -- Mark assignment as completed if exists
  UPDATE snag_assignments
  SET
    status = 'completed',
    completed_at = NEW.resolved_at
  WHERE snag_id = NEW.snag_id
  AND status IN ('assigned', 'overdue');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to link resolution
DROP TRIGGER IF EXISTS on_resolution_created ON snag_resolutions;
CREATE TRIGGER on_resolution_created
  AFTER INSERT ON snag_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION link_resolution_to_snag();

-- =============================================
-- 7. CREATE UPDATED_AT TRIGGERS
-- =============================================

-- Add updated_at trigger for snag_assignments
DROP TRIGGER IF EXISTS update_snag_assignments_updated_at ON snag_assignments;
CREATE TRIGGER update_snag_assignments_updated_at
  BEFORE UPDATE ON snag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
