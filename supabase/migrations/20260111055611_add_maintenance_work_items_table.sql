/*
  # Add Maintenance Work Items Table

  1. New Tables
    - `maintenance_work_items`
      - `id` (uuid, primary key)
      - `maintenance_log_id` (uuid, foreign key to maintenance_logs)
      - `work_description` (text) - Description of the work performed
      - `work_category` (text) - Category of work (Engine/Fuel, Gearbox, etc.)
      - `photo_urls` (text[]) - Array of photo URLs for this work item
      - `order_index` (integer) - Order of work items
      - `created_at` (timestamptz)

  2. Changes to existing tables
    - Deprecate `work_done`, `work_category`, and `photo_urls` from maintenance_logs
      (keeping them for backward compatibility but new records will use work_items table)

  3. Security
    - Enable RLS on `maintenance_work_items` table
    - Add policies for authenticated users to manage work items based on branch access
*/

-- Create maintenance_work_items table
CREATE TABLE IF NOT EXISTS maintenance_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_log_id uuid NOT NULL REFERENCES maintenance_logs(id) ON DELETE CASCADE,
  work_description text NOT NULL,
  work_category text,
  photo_urls text[] DEFAULT '{}',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE maintenance_work_items ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_work_items_log_id 
ON maintenance_work_items(maintenance_log_id);

-- RLS Policies for maintenance_work_items
CREATE POLICY "Users can view work items for maintenance logs they can access"
  ON maintenance_work_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_logs ml
      WHERE ml.id = maintenance_work_items.maintenance_log_id
    )
  );

CREATE POLICY "Users can insert work items for maintenance logs they can create"
  ON maintenance_work_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_logs ml
      WHERE ml.id = maintenance_work_items.maintenance_log_id
    )
  );

CREATE POLICY "Users can update work items for maintenance logs they can update"
  ON maintenance_work_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_logs ml
      WHERE ml.id = maintenance_work_items.maintenance_log_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_logs ml
      WHERE ml.id = maintenance_work_items.maintenance_log_id
    )
  );

CREATE POLICY "Users can delete work items for maintenance logs they can delete"
  ON maintenance_work_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_logs ml
      WHERE ml.id = maintenance_work_items.maintenance_log_id
    )
  );