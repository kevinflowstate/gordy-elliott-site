-- The history trigger calls this for authenticated direct writes too. Only answer for the caller's own
-- sessions (or service/no-JWT contexts), so it cannot be used to probe another client's moved workouts.
CREATE OR REPLACE FUNCTION public.training_date_override_state(p_kind text, p_session_id uuid, p_week_start date, p_date date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.client_exercise_sessions s
      JOIN public.client_exercise_plans p ON p.id = s.plan_id
      JOIN public.client_profiles cp ON cp.id = p.client_id
      WHERE s.id = p_session_id AND cp.user_id = auth.uid()) THEN NULL
    WHEN p_kind = 'assignment' THEN (
      SELECT 'occupied' FROM public.client_training_date_overrides o
      JOIN public.client_exercise_sessions s ON s.id = p_session_id AND s.plan_id = o.plan_id
      WHERE o.planned_date = p_date AND NOT (o.session_id = p_session_id AND o.source_week_start = p_week_start)
      LIMIT 1)
    WHEN EXISTS (SELECT 1 FROM public.client_training_date_overrides o WHERE o.session_id = p_session_id AND o.planned_date = p_date)
      THEN 'moved_here'
    WHEN EXISTS (SELECT 1 FROM public.client_training_date_overrides o WHERE o.session_id = p_session_id
      AND o.source_week_start = p_date - (extract(isodow FROM p_date)::integer - 1) AND o.planned_date <> p_date)
      THEN 'moved_away'
  END;
$$;
REVOKE ALL ON FUNCTION public.training_date_override_state(text, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_date_override_state(text, uuid, date, date) TO authenticated, service_role;
