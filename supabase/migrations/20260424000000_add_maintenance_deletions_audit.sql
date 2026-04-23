-- Audit table for deleted maintenance logs (mirrors snag_deletions pattern)
create table if not exists maintenance_deletions (
  id uuid primary key default gen_random_uuid(),
  maintenance_log_id uuid not null,
  vehicle_id uuid not null,
  service_date date,
  mileage numeric,
  work_done text,
  performed_by text,
  deleted_by uuid references auth.users(id),
  deletion_reason text not null,
  original_data jsonb,
  branch_id uuid,
  created_at timestamptz not null default now()
);

alter table maintenance_deletions enable row level security;

-- Users can only insert audit records for deletions they performed
create policy "Users can insert own maintenance deletions"
  on maintenance_deletions for insert
  to authenticated
  with check (deleted_by = auth.uid());

-- Authenticated users can view all audit records
create policy "Authenticated users can view maintenance deletions"
  on maintenance_deletions for select
  to authenticated
  using (true);
