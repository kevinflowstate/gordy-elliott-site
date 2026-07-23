CREATE OR REPLACE VIEW public.client_attention_latest_activity
WITH (security_invoker = true)
AS
SELECT
  profiles.id AS client_id,
  exercise.last_training,
  metrics.last_daily_metric,
  nutrition.last_nutrition,
  wearables.last_wearable_sync
FROM public.client_profiles AS profiles
LEFT JOIN (
  SELECT client_id, MAX(log_date) AS last_training
  FROM public.client_exercise_logs
  WHERE completed = true
    AND log_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
  GROUP BY client_id
) AS exercise ON exercise.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(tracked_date) AS last_daily_metric
  FROM public.client_daily_metrics
  WHERE tracked_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
  GROUP BY client_id
) AS metrics ON metrics.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(tracked_date) AS last_nutrition
  FROM public.client_meal_tracking
  WHERE completed = true
    AND tracked_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
  GROUP BY client_id
) AS nutrition ON nutrition.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(summary_date) AS last_wearable_sync
  FROM public.client_wearable_daily_summaries
  WHERE summary_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
  GROUP BY client_id
) AS wearables ON wearables.client_id = profiles.id;

REVOKE ALL ON public.client_attention_latest_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_attention_latest_activity TO service_role;
