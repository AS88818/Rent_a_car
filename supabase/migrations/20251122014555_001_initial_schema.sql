/*
  # Fleet Management System - Initial Schema

  1. New Tables
    - `branches` - Store branch information (Nairobi, Nanyuki)
    - `vehicle_categories` - Configurable vehicle categories (Van, Truck, Car, SUV)
    - `users` - User accounts with role-based access
    - `user_roles` - Role definitions (Admin, Fleet Manager, Basic User)
    - `vehicles` - Fleet vehicles with health tracking
    - `bookings` - Vehicle bookings with conflict detection
    - `mileage_logs` - Mileage tracking with calculated fields
    - `maintenance_logs` - Maintenance history
    - `snags` - Vehicle issues with priority levels
    - `settings` - System-wide configuration

  2. Security
    - Enable RLS on all tables
    - Create policies for role-based and branch-scoped access
*/

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name text UNIQUE NOT NULL,
  location text NOT NULL,
  contact_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches are viewable by authenticated users"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can update branches"
  ON branches FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Vehicle Categories Table
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by authenticated users"
  ON vehicle_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage categories"
  ON vehicle_categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can update categories"
  ON vehicle_categories FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_number text UNIQUE NOT NULL,
  category_id uuid NOT NULL REFERENCES vehicle_categories(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On Hire', 'Grounded')),
  health_flag text NOT NULL DEFAULT 'Excellent' CHECK (health_flag IN ('Excellent', 'OK', 'Grounded')),
  insurance_expiry date NOT NULL,
  mot_expiry date NOT NULL,
  current_mileage numeric NOT NULL DEFAULT 0,
  last_mileage_update date,
  market_value numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vehicles_branch_id ON vehicles(branch_id);
CREATE INDEX idx_vehicles_category_id ON vehicles(category_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);

CREATE POLICY "Users can view vehicles in their branch"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Fleet managers and admins can create vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'fleet_manager')
    AND (
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN true
        ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
      END
    )
  );

CREATE POLICY "Fleet managers and admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'fleet_manager')
    AND (
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN true
        ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
      END
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'fleet_manager')
    AND (
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN true
        ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
      END
    )
  );

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  client_name text NOT NULL,
  contact text NOT NULL,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  start_location text NOT NULL,
  end_location text NOT NULL,
  notes text,
  health_at_booking text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_bookings_vehicle_id ON bookings(vehicle_id);
CREATE INDEX idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_datetime ON bookings(start_datetime, end_datetime);

CREATE POLICY "Users can view bookings in their branch"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can create bookings in their branch"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can update bookings in their branch"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  )
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

-- Mileage Logs Table
CREATE TABLE IF NOT EXISTS mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  reading_datetime timestamptz NOT NULL,
  mileage_reading numeric NOT NULL,
  km_since_last numeric,
  days_since_last integer,
  km_per_day numeric,
  branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mileage_logs_vehicle_id ON mileage_logs(vehicle_id);
CREATE INDEX idx_mileage_logs_branch_id ON mileage_logs(branch_id);
CREATE INDEX idx_mileage_logs_reading_datetime ON mileage_logs(reading_datetime DESC);

CREATE POLICY "Users can view mileage logs in their branch"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can log mileage in their branch"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

-- Maintenance Logs Table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  service_date date NOT NULL,
  mileage numeric NOT NULL,
  work_done text NOT NULL,
  performed_by text NOT NULL,
  notes text,
  branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_maintenance_logs_vehicle_id ON maintenance_logs(vehicle_id);
CREATE INDEX idx_maintenance_logs_branch_id ON maintenance_logs(branch_id);
CREATE INDEX idx_maintenance_logs_service_date ON maintenance_logs(service_date DESC);

CREATE POLICY "Users can view maintenance logs in their branch"
  ON maintenance_logs FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can create maintenance logs in their branch"
  ON maintenance_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

-- Snags Table
CREATE TABLE IF NOT EXISTS snags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  priority text NOT NULL CHECK (priority IN ('Dangerous', 'Important', 'Nice to Fix', 'Aesthetic')),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  date_opened date NOT NULL,
  date_closed date,
  description text NOT NULL,
  branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE snags ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_snags_vehicle_id ON snags(vehicle_id);
CREATE INDEX idx_snags_branch_id ON snags(branch_id);
CREATE INDEX idx_snags_status ON snags(status);
CREATE INDEX idx_snags_priority ON snags(priority);

CREATE POLICY "Users can view snags in their branch"
  ON snags FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can create snags in their branch"
  ON snags FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

CREATE POLICY "Users can update snags in their branch"
  ON snags FOR UPDATE
  TO authenticated
  USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  )
  WITH CHECK (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE branch_id = (auth.jwt() ->> 'branch_id')::uuid
    END
  );

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by authenticated users"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');