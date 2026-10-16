-- Review fixes for the training calendar (forward migration; 20261016100000 and 20261016110000 are already applied).
-- 1. A logged occurrence keeps its date on every weekly-planner write path, not only through save_training_calendar_date.
-- 2. Undo refuses to restore a workout onto a date another workout now uses, instead of leaving it unplaced.
-- 3. Rest-day saves and workout logging are serialised per client/date; a logged workout always clears that date's rest marker.
-- Re-runnable: functions are replaced and triggers recreated.

-- Per client/date transaction lock shared by rest-day saves and workout writes.
CREATE OR REPLACE FUNCTION public.lock_training_day(p_client_id uuid, p_date date)
RETURNS void LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('training-day:' || p_client_id::text), p_date - DATE '2000-01-01');
$$;
REVOKE ALL ON FUNCTION public.lock_training_day(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_training_day(uuid, date) TO service_role;

-- Where a static plan's recurring pattern places a session in a week (NULL when it does not repeat there).
-- Mirrors the weekly loader: the latest earlier recurring or stopped row wins.
CREATE OR REPLACE FUNCTION public.training_recurring_date(p_client_id uuid, p_plan_id uuid, p_session_id uuid, p_week_start date)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN r.recurrence_stopped THEN NULL ELSE p_week_start + least(6, greatest(0, r.planned_date - r.week_start)) END
  FROM (
    SELECT a.week_start, a.planned_date, a.recurrence_stopped
    FROM public.client_training_weekly_assignments a
    WHERE a.client_id = p_client_id AND a.plan_id = p_plan_id AND a.session_id = p_session_id AND a.week_start < p_week_start
      AND (a.recurrence_stopped OR (a.is_recurring AND a.planned_date IS NOT NULL))
    ORDER BY a.week_start DESC
    LIMIT 1
  ) r;
$$;
REVOKE ALL ON FUNCTION public.training_recurring_date(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.training_recurring_date(uuid, uuid, uuid, date) TO service_role;

-- Dates a week's occurrence of a session has been logged on: its own week (less dates other weeks' occurrences
-- were moved to) plus the date it was itself moved to. Same rule save_training_calendar_date applies.
CREATE OR REPLACE FUNCTION public.training_occurrence_log_dates(p_client_id uuid, p_session_id uuid, p_week_start date)
RETURNS date[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT l.log_date ORDER BY l.log_date), '{}')
  FROM (
    SELECT log_date FROM public.client_exercise_logs WHERE client_id = p_client_id AND session_id = p_session_id
    UNION ALL
    SELECT log_date FROM public.client_exercise_session_summaries WHERE client_id = p_client_id AND session_id = p_session_id
  ) l
  WHERE (l.log_date BETWEEN p_week_start AND p_week_start + 6 AND NOT EXISTS (
      SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = p_client_id AND o.session_id = p_session_id
        AND o.planned_date = l.log_date AND o.source_week_start <> p_week_start))
    OR EXISTS (
      SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = p_client_id AND o.session_id = p_session_id
        AND o.source_week_start = p_week_start AND o.planned_date = l.log_date);
$$;
REVOKE ALL ON FUNCTION public.training_occurrence_log_dates(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.training_occurrence_log_dates(uuid, uuid, date) TO service_role;

-- Weekly-planner writes (client planner, coach batch planner, direct writes and deletes) cannot move or unplan a
-- placed occurrence that has been logged. Placing it on a date it was logged on is allowed, as are recurrence
-- changes that keep its date and first placements of a week with no plan yet (coach Copy/Repeat, any-day logs).
-- The plan row lock serialises planner writes with moves and undo (FOR UPDATE) and with workout logging
-- (the history trigger's FOR SHARE); it is taken here first so concurrent planner writes never upgrade a share lock.
CREATE OR REPLACE FUNCTION public.guard_logged_training_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.client_training_weekly_assignments; v_static boolean; v_current date; v_next date; v_found boolean;
  v_logged date[];
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  SELECT p.programme_weeks IS NULL INTO v_static FROM public.client_exercise_plans p WHERE p.id = v_row.plan_id FOR NO KEY UPDATE;
  IF TG_OP = 'DELETE' THEN
    -- Deleting the explicit row returns the week to its recurring date (static plans) or to unplanned.
    v_current := OLD.planned_date;
    v_next := CASE WHEN v_static THEN public.training_recurring_date(OLD.client_id, OLD.plan_id, OLD.session_id, OLD.week_start) END;
  ELSIF TG_OP = 'UPDATE' AND NEW.session_id = OLD.session_id AND NEW.week_start = OLD.week_start THEN
    v_current := OLD.planned_date;
    v_next := NEW.planned_date;
  ELSE
    SELECT a.planned_date, true INTO v_current, v_found FROM public.client_training_weekly_assignments a
      WHERE a.client_id = NEW.client_id AND a.plan_id = NEW.plan_id AND a.session_id = NEW.session_id AND a.week_start = NEW.week_start;
    IF v_found IS NOT TRUE AND v_static IS TRUE THEN
      v_current := public.training_recurring_date(NEW.client_id, NEW.plan_id, NEW.session_id, NEW.week_start);
    END IF;
    v_next := NEW.planned_date;
  END IF;
  IF v_current IS NOT NULL AND v_next IS DISTINCT FROM v_current THEN
    v_logged := public.training_occurrence_log_dates(v_row.client_id, v_row.session_id, v_row.week_start);
    IF cardinality(v_logged) > 0 AND (v_next IS NULL OR NOT v_next = ANY(v_logged)) THEN
      RAISE EXCEPTION 'This workout is already logged for that week, so its date stays as it is';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_logged_training_assignment() FROM PUBLIC, anon, authenticated;
-- Named to fire before exercise_assignments_plan_lock (triggers run in name order).
DROP TRIGGER IF EXISTS assignments_logged_date_guard ON public.client_training_weekly_assignments;
CREATE TRIGGER assignments_logged_date_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_training_weekly_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_logged_training_assignment();

-- A completed workout log or a session summary clears that date's rest marker in the same transaction,
-- under the same per-day lock save_manual_training_activity takes before its check.
CREATE OR REPLACE FUNCTION public.clear_rest_day_for_workout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Nested: only the logs table has completed (PL/pgSQL does not short-circuit).
  IF TG_TABLE_NAME = 'client_exercise_logs' THEN
    IF NEW.completed IS NOT TRUE THEN RETURN NULL; END IF;
  END IF;
  PERFORM public.lock_training_day(NEW.client_id, NEW.log_date);
  DELETE FROM public.client_manual_training_activity
    WHERE client_id = NEW.client_id AND activity_date = NEW.log_date AND kind = 'rest';
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_rest_day_for_workout() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS exercise_logs_clear_rest_day ON public.client_exercise_logs;
CREATE TRIGGER exercise_logs_clear_rest_day AFTER INSERT OR UPDATE ON public.client_exercise_logs
  FOR EACH ROW EXECUTE FUNCTION public.clear_rest_day_for_workout();
DROP TRIGGER IF EXISTS exercise_summaries_clear_rest_day ON public.client_exercise_session_summaries;
CREATE TRIGGER exercise_summaries_clear_rest_day AFTER INSERT OR UPDATE ON public.client_exercise_session_summaries
  FOR EACH ROW EXECUTE FUNCTION public.clear_rest_day_for_workout();

-- Undo checks where the occurrence returns to (its explicit row, else its recurring weekday) and refuses
-- when another workout now uses that date. Plan lock held throughout, so check and delete are atomic.
CREATE OR REPLACE FUNCTION public.clear_training_calendar_date(p_user_id uuid, p_plan_id uuid, p_session_id uuid, p_source_week date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_client uuid; v_row public.client_training_date_overrides; v_static boolean; v_restore date; v_explicit boolean;
BEGIN
  SELECT cp.id INTO v_client FROM public.client_profiles cp
    WHERE cp.user_id = p_user_id AND (cp.programme_type IS DISTINCT FROM 'boardroom' OR cp.fitness_plans_enabled IS TRUE);
  IF v_client IS NULL THEN RAISE EXCEPTION 'Training access unavailable'; END IF;
  SELECT p.programme_weeks IS NULL INTO v_static FROM public.client_exercise_plans p
    WHERE p.id = p_plan_id AND p.client_id = v_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found on your active plan'; END IF;
  SELECT * INTO v_row FROM public.client_training_date_overrides
    WHERE client_id = v_client AND plan_id = p_plan_id AND session_id = p_session_id AND source_week_start = p_source_week;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.client_exercise_logs WHERE client_id = v_client AND session_id = p_session_id AND log_date = v_row.planned_date)
    OR EXISTS (SELECT 1 FROM public.client_exercise_session_summaries WHERE client_id = v_client AND session_id = p_session_id AND log_date = v_row.planned_date) THEN
    RAISE EXCEPTION 'This workout has already been logged on its new date, so the move stays in place';
  END IF;

  SELECT a.planned_date, true INTO v_restore, v_explicit FROM public.client_training_weekly_assignments a
    WHERE a.client_id = v_client AND a.plan_id = p_plan_id AND a.session_id = p_session_id AND a.week_start = p_source_week;
  IF v_explicit IS NOT TRUE AND v_static THEN
    v_restore := public.training_recurring_date(v_client, p_plan_id, p_session_id, p_source_week);
  END IF;
  IF v_restore IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.client_training_date_overrides o WHERE o.client_id = v_client AND o.plan_id = p_plan_id
      AND o.planned_date = v_restore AND o.id <> v_row.id)
    OR EXISTS (SELECT 1 FROM public.client_training_weekly_assignments a WHERE a.client_id = v_client AND a.plan_id = p_plan_id
      AND a.week_start = p_source_week AND a.planned_date = v_restore AND a.session_id <> p_session_id)) THEN
    RAISE EXCEPTION 'Undo would put this workout back on %, which now has another workout. Move that one first, or pick a new date for this workout',
      to_char(v_restore, 'Dy FMDD Mon');
  END IF;
  DELETE FROM public.client_training_date_overrides WHERE id = v_row.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_training_calendar_date(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_training_calendar_date(uuid, uuid, uuid, date) TO service_role;

-- Same rules as before; the check and write now run under the per-day lock shared with workout writes.
CREATE OR REPLACE FUNCTION public.save_manual_training_activity(p_user_id uuid, p_date date, p_kind text, p_minutes integer, p_notes text, p_today date)
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
  -- Waits for any in-flight workout write on this date; the check below then sees it once committed.
  PERFORM public.lock_training_day(v_client, p_date);
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
