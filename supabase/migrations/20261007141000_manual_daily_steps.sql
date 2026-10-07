ALTER TABLE public.client_daily_metrics
  ADD COLUMN IF NOT EXISTS manual_steps INTEGER
  CONSTRAINT client_daily_metrics_manual_steps_nonnegative CHECK (manual_steps >= 0);

COMMENT ON COLUMN public.client_daily_metrics.manual_steps IS
  'Optional manual daily step total. NULL uses the same-date synced total; zero is a valid manual override. Never sum manual and synced steps.';
