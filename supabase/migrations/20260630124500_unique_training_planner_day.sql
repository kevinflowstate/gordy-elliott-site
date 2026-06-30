CREATE UNIQUE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_unique_day
  ON public.client_training_weekly_assignments(client_id, plan_id, week_start, planned_date)
  WHERE planned_date IS NOT NULL;
