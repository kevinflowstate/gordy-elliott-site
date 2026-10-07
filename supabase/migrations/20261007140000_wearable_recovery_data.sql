-- Unknown recovery is a first-class state. A nutrition/activity-only day
-- must not inherit the previous unconditional 82/good default.
ALTER TABLE public.client_wearable_daily_summaries
  DROP CONSTRAINT IF EXISTS client_wearable_daily_summaries_recovery_status_check;
ALTER TABLE public.client_wearable_daily_summaries
  ALTER COLUMN recovery_status SET DEFAULT 'unknown';
ALTER TABLE public.client_wearable_daily_summaries
  ADD CONSTRAINT client_wearable_daily_summaries_recovery_status_check
  CHECK (recovery_status IN ('unknown', 'good', 'watch', 'reduce_intensity'));

-- Sleep duration/score are one domain, HRV and resting heart rate another
-- measure each. Match hasSufficientRecoverySignals: at least two measures,
-- excluding zero heart/duration placeholders but retaining a valid score0.
-- Repair derived fields only. Keep raw sleep/activity/nutrition, source IDs,
-- original events and their original sync/update timestamps untouched.
UPDATE public.client_wearable_daily_summaries
SET readiness_score = NULL,
    recovery_status = 'unknown',
    flags = '{}'::TEXT[],
    insight = NULL
WHERE (
  CASE WHEN sleep_minutes > 0 OR sleep_score BETWEEN 0 AND 100 THEN 1 ELSE 0 END
  + CASE WHEN hrv_ms > 0 AND hrv_ms NOT IN ('NaN'::NUMERIC, 'Infinity'::NUMERIC, '-Infinity'::NUMERIC) THEN 1 ELSE 0 END
  + CASE WHEN resting_hr_bpm > 0 THEN 1 ELSE 0 END
) < 2;
