CREATE TABLE IF NOT EXISTS public.client_lifecycle_notes (
  client_id UUID PRIMARY KEY REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (char_length(note) <= 500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.client_lifecycle_notes (client_id, note)
SELECT id, lifecycle_note
FROM public.client_profiles
WHERE lifecycle_note IS NOT NULL AND btrim(lifecycle_note) <> ''
ON CONFLICT (client_id) DO UPDATE
SET note = EXCLUDED.note, updated_at = NOW();

ALTER TABLE public.client_profiles DROP COLUMN IF EXISTS lifecycle_note;

ALTER TABLE public.client_lifecycle_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_lifecycle_notes TO authenticated;

DROP POLICY IF EXISTS "Admins manage client lifecycle notes" ON public.client_lifecycle_notes;
CREATE POLICY "Admins manage client lifecycle notes"
  ON public.client_lifecycle_notes
  FOR ALL
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins manage client monitoring preferences" ON public.client_monitoring_preferences;
CREATE POLICY "Admins manage client monitoring preferences"
  ON public.client_monitoring_preferences
  FOR ALL
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins manage client attention snoozes" ON public.client_attention_snoozes;
CREATE POLICY "Admins manage client attention snoozes"
  ON public.client_attention_snoozes
  FOR ALL
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP INDEX IF EXISTS public.idx_client_attention_snoozes_client;

DELETE FROM public.client_attention_snoozes
WHERE ignored = false AND snoozed_until IS NULL;

UPDATE public.client_attention_snoozes
SET snoozed_until = NULL
WHERE ignored = true AND snoozed_until IS NOT NULL;

ALTER TABLE public.client_attention_snoozes
  DROP CONSTRAINT IF EXISTS client_attention_snoozes_mode_check;

ALTER TABLE public.client_attention_snoozes
  ADD CONSTRAINT client_attention_snoozes_mode_check
  CHECK (
    (ignored = true AND snoozed_until IS NULL)
    OR (ignored = false AND snoozed_until IS NOT NULL)
  );

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
  GROUP BY client_id
) AS exercise ON exercise.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(tracked_date) AS last_daily_metric
  FROM public.client_daily_metrics
  GROUP BY client_id
) AS metrics ON metrics.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(tracked_date) AS last_nutrition
  FROM public.client_meal_tracking
  WHERE completed = true
  GROUP BY client_id
) AS nutrition ON nutrition.client_id = profiles.id
LEFT JOIN (
  SELECT client_id, MAX(summary_date) AS last_wearable_sync
  FROM public.client_wearable_daily_summaries
  GROUP BY client_id
) AS wearables ON wearables.client_id = profiles.id;

REVOKE ALL ON public.client_attention_latest_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_attention_latest_activity TO service_role;

CREATE OR REPLACE FUNCTION public.update_client_operations(
  p_client_id UUID,
  p_status TEXT,
  p_resumes_at TIMESTAMPTZ,
  p_note TEXT,
  p_monitoring JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous_status TEXT;
  previous_paused_at TIMESTAMPTZ;
BEGIN
  IF p_status NOT IN ('active', 'paused', 'access_frozen') THEN
    RAISE EXCEPTION 'Invalid lifecycle status';
  END IF;

  SELECT lifecycle_status, lifecycle_paused_at
  INTO previous_status, previous_paused_at
  FROM public.client_profiles
  WHERE id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  UPDATE public.client_profiles
  SET
    lifecycle_status = p_status,
    lifecycle_paused_at = CASE
      WHEN p_status = 'active' THEN NULL
      WHEN previous_status = 'active' THEN NOW()
      ELSE COALESCE(previous_paused_at, NOW())
    END,
    lifecycle_resumes_at = CASE WHEN p_status = 'active' THEN NULL ELSE p_resumes_at END
  WHERE id = p_client_id;

  IF p_status = 'active' OR NULLIF(btrim(p_note), '') IS NULL THEN
    DELETE FROM public.client_lifecycle_notes WHERE client_id = p_client_id;
  ELSE
    INSERT INTO public.client_lifecycle_notes (client_id, note, updated_at)
    VALUES (p_client_id, left(btrim(p_note), 500), NOW())
    ON CONFLICT (client_id) DO UPDATE
    SET note = EXCLUDED.note, updated_at = NOW();
  END IF;

  IF p_monitoring IS NOT NULL THEN
    INSERT INTO public.client_monitoring_preferences (
      client_id,
      monitor_login,
      monitor_checkins,
      monitor_training,
      monitor_daily_metrics,
      monitor_nutrition,
      monitor_wearables,
      updated_at
    ) VALUES (
      p_client_id,
      COALESCE((p_monitoring ->> 'monitor_login')::BOOLEAN, true),
      COALESCE((p_monitoring ->> 'monitor_checkins')::BOOLEAN, true),
      COALESCE((p_monitoring ->> 'monitor_training')::BOOLEAN, false),
      COALESCE((p_monitoring ->> 'monitor_daily_metrics')::BOOLEAN, false),
      COALESCE((p_monitoring ->> 'monitor_nutrition')::BOOLEAN, false),
      COALESCE((p_monitoring ->> 'monitor_wearables')::BOOLEAN, false),
      NOW()
    )
    ON CONFLICT (client_id) DO UPDATE SET
      monitor_login = EXCLUDED.monitor_login,
      monitor_checkins = EXCLUDED.monitor_checkins,
      monitor_training = EXCLUDED.monitor_training,
      monitor_daily_metrics = EXCLUDED.monitor_daily_metrics,
      monitor_nutrition = EXCLUDED.monitor_nutrition,
      monitor_wearables = EXCLUDED.monitor_wearables,
      updated_at = NOW();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_client_operations(UUID, TEXT, TIMESTAMPTZ, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_operations(UUID, TEXT, TIMESTAMPTZ, TEXT, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_training_assignments_batch(
  p_client_id UUID,
  p_plan_id UUID,
  p_assignments JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  assignment JSONB;
  v_session_id UUID;
  v_week_start DATE;
  v_planned_date DATE;
  v_is_recurring BOOLEAN;
  v_recurrence_stopped BOOLEAN;
BEGIN
  IF jsonb_typeof(p_assignments) <> 'array'
     OR jsonb_array_length(p_assignments) = 0
     OR jsonb_array_length(p_assignments) > 50 THEN
    RAISE EXCEPTION 'Assignments must contain between 1 and 50 items';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_exercise_plans
    WHERE id = p_plan_id AND client_id = p_client_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active plan not found';
  END IF;

  FOR assignment IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_session_id := (assignment ->> 'session_id')::UUID;
    v_week_start := (assignment ->> 'week_start')::DATE;
    v_planned_date := NULLIF(assignment ->> 'planned_date', '')::DATE;
    v_is_recurring := COALESCE((assignment ->> 'is_recurring')::BOOLEAN, false) AND v_planned_date IS NOT NULL;
    v_recurrence_stopped := COALESCE((assignment ->> 'recurrence_stopped')::BOOLEAN, false);

    IF NOT EXISTS (
      SELECT 1
      FROM public.client_exercise_sessions
      WHERE id = v_session_id AND plan_id = p_plan_id
    ) THEN
      RAISE EXCEPTION 'Session not found on active plan';
    END IF;

    IF v_planned_date IS NOT NULL AND date_trunc('week', v_planned_date)::DATE <> v_week_start THEN
      RAISE EXCEPTION 'Planned date must be in the selected week';
    END IF;

    INSERT INTO public.client_training_weekly_assignments (
      client_id,
      plan_id,
      session_id,
      week_start,
      planned_date,
      is_recurring,
      recurrence_stopped,
      updated_at
    ) VALUES (
      p_client_id,
      p_plan_id,
      v_session_id,
      v_week_start,
      v_planned_date,
      v_is_recurring,
      CASE WHEN v_is_recurring THEN false ELSE v_recurrence_stopped END,
      NOW()
    )
    ON CONFLICT (client_id, plan_id, session_id, week_start) DO UPDATE SET
      planned_date = EXCLUDED.planned_date,
      is_recurring = EXCLUDED.is_recurring,
      recurrence_stopped = EXCLUDED.recurrence_stopped,
      updated_at = NOW();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_training_assignments_batch(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_training_assignments_batch(UUID, UUID, JSONB)
  TO service_role;
