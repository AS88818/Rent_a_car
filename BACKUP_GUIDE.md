# Database Backup System

## Overview

Automated daily backups of the Supabase database, stored in a Google Drive folder. Runs at **2:00 UTC every day**. Keeps the last 30 days of backups. Cost: **$0/month**.

---

## How it works

Every night a GitHub Actions workflow:

1. Wakes up at 2:00 UTC
2. Connects to Supabase using the stored connection string
3. Runs `pg_dump` to export the full database as a SQL file
4. Compresses it with gzip
5. Uploads the compressed file to Google Drive (`RentACarBackups` folder)
6. Deletes any backups older than 30 days
7. Cleans up

The workflow file is at `.github/workflows/db-backup.yml`.

---

## Components

| Component | What it is | Where |
|-----------|------------|-------|
| Workflow | The schedule + script that runs the backup | GitHub repo, `.github/workflows/db-backup.yml` |
| `SUPABASE_DB_URL` secret | Full Supabase connection string with password | GitHub repo → Settings → Secrets → Actions |
| `RCLONE_CONFIG_B64` secret | Base64-encoded rclone OAuth config for Google Drive access | GitHub repo → Settings → Secrets → Actions |
| Google Drive folder | Where backup files land | `RentACarBackups` in personal Google Drive |

The Supabase connection uses the **Session Pooler** endpoint (IPv4 compatible). Google Drive access uses **OAuth user credentials** generated via `rclone config`.

---

## Verifying backups are working

Two quick checks:

1. **GitHub Actions** — Repo → Actions tab → "Daily Database Backup" should show green checkmarks for daily runs
2. **Google Drive** — open the `RentACarBackups` folder → confirm a new file appears each day, with a non-trivial file size (KB or MB, not 20 bytes)

---

## Restoring a backup (disaster recovery)

### When to do this
- Accidental deletion of records or tables that can't be reversed
- Database corruption
- Bug that wiped or corrupted production data

### Option A — Restore to a new Supabase project (safest, recommended)

This restores to a fresh database without touching the broken one. If something goes wrong with the restore, the broken database is still there to refer to.

**Steps:**

1. **Create a new Supabase project**
   - supabase.com → New Project
   - Same region as the original (`ap-south-1`)
   - Wait for it to be ready

2. **Get the new project's connection string**
   - Settings → Database → Connection String → URI (Session Pooler)
   - Save it somewhere temporarily

3. **Download the backup**
   - Open Google Drive → `RentACarBackups`
   - Pick the date you want to restore from
   - Download the `.sql.gz` file

4. **Install PostgreSQL 17 client on your machine**
   - Windows: download from postgresql.org or `winget install PostgreSQL.PostgreSQL.17`
   - Mac: `brew install postgresql@17`

5. **Run the restore**
   - Open PowerShell in the folder containing the downloaded backup
   - Decompress: right-click → 7-Zip → Extract Here (you'll get a `.sql` file)
   - Restore:
   ```powershell
   psql "NEW_CONNECTION_STRING" -f "backup_DATE.sql"
   ```
   - Wait for it to finish (could be a few minutes for large databases)

6. **Verify data appears in the new Supabase project** — check tables, row counts, etc.

7. **Switch the app to the new project**
   - Update the app's `.env` / hosting platform with the new Supabase URL and keys
   - Redeploy

### Option B — Restore over the existing database (RISKY)

Only do this if Option A is impossible. This **overwrites** the existing database.

```powershell
psql "CURRENT_CONNECTION_STRING" -f "backup_DATE.sql"
```

You'll probably need to drop existing tables first or the restore will fail with "already exists" errors.

---

## Manual operations

### Run a backup right now (instead of waiting for 2am)

1. GitHub repo → Actions tab
2. Left sidebar → "Daily Database Backup"
3. Click "Run workflow" → green button
4. ~1 minute later, check Google Drive

### Change the schedule

Edit `.github/workflows/db-backup.yml`, line with `cron:`. Format is `minute hour day month weekday` in UTC.

Examples:
- `0 2 * * *` → 2:00 UTC daily (current)
- `0 */6 * * *` → every 6 hours
- `0 0 * * 0` → Sunday midnight only

### Change retention period

Edit `.github/workflows/db-backup.yml`:

```yaml
- name: Delete backups older than 30 days
  run: rclone delete gdrive:RentACarBackups/ --min-age 30d
```

Change `30d` to whatever (e.g., `7d`, `90d`).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Workflow fails "password authentication failed" | `SUPABASE_DB_URL` secret has wrong password | Reset Supabase DB password, update secret with new connection string |
| Workflow fails "server version mismatch" | pg_dump older than Supabase server | Update the `postgresql-client-17` line in the workflow to a newer version |
| Backup file is ~20 bytes | pg_dump failed silently | Check "Create backup" step logs; `set -o pipefail` should already catch this |
| "Service Accounts do not have storage quota" | Old setup using service account | We migrated away from this; should not happen |
| "ACCESS_TOKEN_SCOPE_INSUFFICIENT" | OAuth scope missing Drive | Re-run `rclone config` locally, pick scope `1` (full Drive), update `RCLONE_CONFIG_B64` |
| Token expired | OAuth refresh token revoked | Re-run `rclone config show gdrive` locally, re-encode to base64, update `RCLONE_CONFIG_B64` secret |

### Regenerating the rclone config

If Google Drive auth stops working:

```powershell
rclone config
# Edit the existing "gdrive" remote, or delete and recreate
# Follow the OAuth browser flow
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content "$env:APPDATA\rclone\rclone.conf" -Raw)))
# Copy output → GitHub secret RCLONE_CONFIG_B64 → Update
```

---

## Cost breakdown

| Item | Cost |
|------|------|
| GitHub Actions | $0 (~1 minute/day, free tier covers it) |
| Supabase Free Plan | $0 |
| Google Drive | $0 (uses personal 15GB free quota) |
| **Total** | **$0/month** |

Estimated storage: ~10MB compressed backup × 30 days = ~300MB in Google Drive.

---

## Recommended monthly checks

1. Confirm backups are appearing in Google Drive daily
2. Spot-check one backup by downloading and decompressing — it should be valid SQL starting with `-- PostgreSQL database dump`
3. **Every 3 months**: do a full test restore to a new Supabase project to confirm restorability end-to-end

A backup that has never been restored is not a backup — it's a hope.
