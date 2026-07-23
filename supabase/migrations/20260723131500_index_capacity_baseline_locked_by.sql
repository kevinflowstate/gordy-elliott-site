CREATE INDEX IF NOT EXISTS idx_client_capacity_baselines_locked_by
  ON public.client_capacity_baselines(locked_by)
  WHERE locked_by IS NOT NULL;
