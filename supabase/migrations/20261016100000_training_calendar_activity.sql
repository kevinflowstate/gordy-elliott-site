-- One-off client date moves. A row moves exactly one occurrence (session + original Monday week)
-- to an actual calendar date. Weekly assignments, recurrence and logs are never rewritten, so
-- undoing a move (deleting the row) restores the original schedule exactly.
CREATE TABLE public.client_training_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.client_exercise_plans(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.client_exercise_sessions(id) ON DELETE CASCADE,
  source_week_start date NOT NULL,
  planned_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, plan_id, session_id, source_week_start),
  UNIQUE (client_id, plan_id, planned_date),
  CHECK (extract(isodow FROM source_week_start) = 1),
  CHECK (planned_date BETWEEN source_week_start AND source_week_start + 365)
);
CREATE INDEX client_training_date_overrides_session ON public.client_training_date_overrides(session_id, planned_date);
CREATE INDEX client_training_date_overrides_plan_date ON public.client_training_date_overrides(plan_id, planned_date);
ALTER TABLE public.client_training_date_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_training_date_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_training_date_overrides TO service_role;

-- Manual activity/rest records are client-entered, one per date, and never wearable data or workout completion.
CREATE TABLE public.client_manual_training_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('walking','running','cycling','swimming','mobility','sport','other','rest')),
  duration_minutes integer CHECK (duration_minutes BETWEEN 1 AND 1440),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  source text NOT NULL DEFAULT 'manual' CHECK (source = 'manual'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, activity_date),
  CHECK (kind <> 'rest' OR duration_minutes IS NULL)
);
ALTER TABLE public.client_manual_training_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_manual_training_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_manual_training_activity TO service_role;

-- Called from the history trigger, which also runs for authenticated direct writes; only returns a state word.
CREATE FUNCTION public.training_date_override_state(p_kind text, p_session_id uuid, p_week_start date, p_date date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
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

-- Same programme-week rules as before, plus: no weekly assignment on a moved-in date, and programme
-- logs follow an explicit move (allowed on the new date, refused on the moved-away week's other dates).
CREATE OR REPLACE FUNCTION public.lock_exercise_plan_for_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_start date; v_date date; v_weeks integer; v_session_week integer; v_move text;
BEGIN
  PERFORM p.id FROM public.client_exercise_plans p JOIN public.client_exercise_sessions s ON s.plan_id=p.id
    WHERE s.id=NEW.session_id FOR SHARE OF p;
  SELECT p.start_date,p.programme_weeks,s.week_number INTO v_start,v_weeks,v_session_week
    FROM public.client_exercise_plans p JOIN public.client_exercise_sessions s ON s.plan_id=p.id WHERE s.id=NEW.session_id;
  -- Nested: NEW.planned_date only exists on the assignments table (PL/pgSQL does not short-circuit).
  IF TG_TABLE_NAME='client_training_weekly_assignments' THEN
    IF NEW.planned_date IS NOT NULL
      AND public.training_date_override_state('assignment', NEW.session_id, NEW.week_start, NEW.planned_date) IS NOT NULL THEN
      RAISE EXCEPTION 'That day already has a moved workout' USING ERRCODE = '23505';
    END IF;
  END IF;
  IF v_weeks IS NOT NULL THEN
    IF TG_TABLE_NAME='client_training_weekly_assignments' THEN
      v_date := NEW.planned_date;
      IF NEW.is_recurring THEN RAISE EXCEPTION 'Programme sessions cannot repeat across independent weeks'; END IF;
    ELSE
      v_date := NEW.log_date;
      v_move := public.training_date_override_state('log', NEW.session_id, NULL, v_date);
      IF v_move = 'moved_away' THEN RAISE EXCEPTION 'This workout has been moved to another date'; END IF;
    END IF;
    IF v_date IS NOT NULL AND v_move IS DISTINCT FROM 'moved_here'
      AND (v_date < v_start OR v_session_week IS DISTINCT FROM least(v_weeks,greatest(1,((v_date-v_start)/7)+1))) THEN
      RAISE EXCEPTION 'Workout date does not belong to this programme week';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.save_training_calendar_date(p_user_id uuid, p_plan_id uuid, p_session_id uuid, p_source_week date, p_date date)
RETURNS public.client_training_date_overrides LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_client uuid; v_start date; v_weeks integer; v_session_week integer; v_prior date; v_target_week date;
  v_row public.client_training_date_overrides;
BEGIN
  SELECT cp.id INTO v_client FROM public.client_profiles cp
    WHERE cp.user_id = p_user_id AND (cp.programme_type IS DISTINCT FROM 'boardroom' OR cp.fitness_plans_enabled IS TRUE);
  IF v_client IS NULL THEN RAISE EXCEPTION 'Training access unavailable'; END IF;
  SELECT p.start_date, p.programme_weeks, s.week_number INTO v_start, v_weeks, v_session_week
    FROM public.client_exercise_plans p JOIN public.client_exercise_sessions s ON s.plan_id = p.id
    WHERE p.id = p_plan_id AND p.client_id = v_client AND p.status = 'active' AND s.id = p_session_id
    FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found on your active plan'; END IF;
  IF p_date IS NULL OR p_source_week IS NULL OR extract(isodow FROM p_source_week) <> 1
    OR p_date < p_source_week OR p_date > p_source_week + 365 OR (v_weeks IS NOT NULL AND p_date < v_start) THEN
    RAISE EXCEPTION 'Choose a date from this training week onwards, within a year';
  END IF;
  IF v_weeks IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM generate_series(p_source_week, p_source_week + 6, interval '1 day') d
    WHERE d::date >= v_start AND least(v_weeks, greatest(1, ((d::date - v_start) / 7) + 1)) = v_session_week) THEN
    RAISE EXCEPTION 'This workout is not part of that programme week';
  END IF;
  v_target_week := p_date - (extract(isodow FROM p_date)::integer - 1);
  SELECT planned_date INTO v_prior FROM public.client_training_date_overrides
    WHERE client_id = v_client AND plan_id = p_plan_id AND session_id = p_session_id AND source_week_start = p_source_week;

  -- A logged occurrence keeps its date. Logs on dates other occurrences were moved to belong to those occurrences.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT log_date FROM public.client_exercise_logs WHERE client_id = v_client AND session_id = p_session_id
      UNION ALL
      SELECT log_date FROM public.client_exercise_session_summaries WHERE client_id = v_client AND session_id = p_session_id
    ) l
    WHERE l.log_date = v_prior OR (l.log_date BETWEEN p_source_week AND p_source_week + 6 AND NOT EXISTS (
      SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = v_client AND o.session_id = p_session_id
        AND o.planned_date = l.log_date AND o.source_week_start <> p_source_week))) THEN
    RAISE EXCEPTION 'This workout has already been logged, so its date and history stay as they are';
  END IF;

  IF EXISTS (SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = v_client AND o.plan_id = p_plan_id
      AND o.planned_date = p_date AND NOT (o.session_id = p_session_id AND o.source_week_start = p_source_week))
    OR EXISTS (SELECT 1 FROM public.client_training_weekly_assignments a WHERE a.client_id = v_client AND a.plan_id = p_plan_id
      AND a.week_start = v_target_week AND a.planned_date = p_date AND NOT (a.session_id = p_session_id AND a.week_start = p_source_week))
    OR (v_weeks IS NULL AND EXISTS (
      SELECT 1 FROM (
        SELECT DISTINCT ON (a.session_id) a.session_id, a.week_start, a.planned_date, a.recurrence_stopped
        FROM public.client_training_weekly_assignments a
        WHERE a.client_id = v_client AND a.plan_id = p_plan_id AND a.week_start < v_target_week
          AND (a.recurrence_stopped OR (a.is_recurring AND a.planned_date IS NOT NULL))
        ORDER BY a.session_id, a.week_start DESC
      ) r
      WHERE NOT r.recurrence_stopped
        AND v_target_week + least(6, greatest(0, r.planned_date - r.week_start)) = p_date
        AND NOT (r.session_id = p_session_id AND v_target_week = p_source_week)
        AND NOT EXISTS (SELECT 1 FROM public.client_training_weekly_assignments x WHERE x.client_id = v_client
          AND x.plan_id = p_plan_id AND x.session_id = r.session_id AND x.week_start = v_target_week)
        AND NOT EXISTS (SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = v_client
          AND o.plan_id = p_plan_id AND o.session_id = r.session_id AND o.source_week_start = v_target_week))) THEN
    RAISE EXCEPTION 'That date already has a planned session';
  END IF;

  INSERT INTO public.client_training_date_overrides(client_id, plan_id, session_id, source_week_start, planned_date)
  VALUES (v_client, p_plan_id, p_session_id, p_source_week, p_date)
  ON CONFLICT (client_id, plan_id, session_id, source_week_start)
    DO UPDATE SET planned_date = excluded.planned_date, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.save_training_calendar_date(uuid, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_training_calendar_date(uuid, uuid, uuid, date, date) TO service_role;

CREATE FUNCTION public.clear_training_calendar_date(p_user_id uuid, p_plan_id uuid, p_session_id uuid, p_source_week date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_client uuid; v_row public.client_training_date_overrides;
BEGIN
  SELECT cp.id INTO v_client FROM public.client_profiles cp
    WHERE cp.user_id = p_user_id AND (cp.programme_type IS DISTINCT FROM 'boardroom' OR cp.fitness_plans_enabled IS TRUE);
  IF v_client IS NULL THEN RAISE EXCEPTION 'Training access unavailable'; END IF;
  PERFORM 1 FROM public.client_exercise_plans p WHERE p.id = p_plan_id AND p.client_id = v_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found on your active plan'; END IF;
  SELECT * INTO v_row FROM public.client_training_date_overrides
    WHERE client_id = v_client AND plan_id = p_plan_id AND session_id = p_session_id AND source_week_start = p_source_week;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.client_exercise_logs WHERE client_id = v_client AND session_id = p_session_id AND log_date = v_row.planned_date)
    OR EXISTS (SELECT 1 FROM public.client_exercise_session_summaries WHERE client_id = v_client AND session_id = p_session_id AND log_date = v_row.planned_date) THEN
    RAISE EXCEPTION 'This workout has already been logged on its new date, so the move stays in place';
  END IF;
  DELETE FROM public.client_training_date_overrides WHERE id = v_row.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_training_calendar_date(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_training_calendar_date(uuid, uuid, uuid, date) TO service_role;

CREATE FUNCTION public.save_manual_training_activity(p_user_id uuid, p_date date, p_kind text, p_minutes integer, p_notes text, p_today date)
RETURNS public.client_manual_training_activity LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_client uuid; v_row public.client_manual_training_activity;
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Europe/London')::date);
BEGIN
  -- p_today is the client's programme date; allow at most one day of timezone slack beyond the UTC date.
  IF v_today > (now() AT TIME ZONE 'UTC')::date + 1 THEN v_today := (now() AT TIME ZONE 'UTC')::date + 1; END IF;
  SELECT id INTO v_client FROM public.client_profiles
    WHERE user_id = p_user_id AND (programme_type IS DISTINCT FROM 'boardroom' OR fitness_plans_enabled IS TRUE);
  IF v_client IS NULL THEN RAISE EXCEPTION 'Training access unavailable'; END IF;
  IF p_date IS NULL OR p_date > v_today OR p_date < v_today - 365 THEN
    RAISE EXCEPTION 'Choose a date in the past year, up to today';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('walking','running','cycling','swimming','mobility','sport','other','rest')
    OR length(coalesce(p_notes, '')) > 1000 OR (p_kind <> 'rest' AND p_minutes IS NOT NULL AND p_minutes NOT BETWEEN 1 AND 1440) THEN
    RAISE EXCEPTION 'Choose valid activity details';
  END IF;
  IF p_kind = 'rest' AND (
    EXISTS (SELECT 1 FROM public.client_exercise_logs WHERE client_id = v_client AND log_date = p_date AND completed IS TRUE)
    OR EXISTS (SELECT 1 FROM public.client_exercise_session_summaries WHERE client_id = v_client AND log_date = p_date)) THEN
    RAISE EXCEPTION 'A workout is already logged on this date. Record an activity instead of a rest day';
  END IF;
  INSERT INTO public.client_manual_training_activity(client_id, activity_date, kind, duration_minutes, notes)
  VALUES (v_client, p_date, p_kind, CASE WHEN p_kind = 'rest' THEN NULL ELSE p_minutes END, coalesce(p_notes, ''))
  ON CONFLICT (client_id, activity_date) DO UPDATE
    SET kind = excluded.kind, duration_minutes = excluded.duration_minutes, notes = excluded.notes, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.save_manual_training_activity(uuid, date, text, integer, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_manual_training_activity(uuid, date, text, integer, text, date) TO service_role;
