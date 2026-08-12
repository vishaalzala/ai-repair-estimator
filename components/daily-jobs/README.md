# Daily Jobs

Daily Jobs is an operational command centre, not a second workflow database.

- Job status writes to `jobs.status` and records `job_status_history`.
- Parts status writes to the current `parts_requests` row and related selected items when appropriate.
- Photos, estimates, AI review, reports and supplements are read from their native tables.
- `job_schedules` stores only daily planning metadata (scheduled date, priority, completion marker).
- `daily_tasks` stores only standalone follow-ups that do not already belong to a native workflow module.

This prevents duplicate status sources and keeps changes made on native module pages visible on `/daily-jobs` automatically.