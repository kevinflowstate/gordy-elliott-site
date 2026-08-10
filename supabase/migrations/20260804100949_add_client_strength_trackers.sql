CREATE TABLE IF NOT EXISTS public.client_strength_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  metric_type TEXT NOT NULL DEFAULT 'load_reps'
    CHECK (metric_type IN ('load_reps', 'reps', 'duration')),
  order_index SMALLINT NOT NULL DEFAULT 0 CHECK (order_index BETWEEN 0 AND 4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, exercise_id),
  CHECK (
    (is_active AND retired_at IS NULL)
    OR (NOT is_active AND retired_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_client_strength_trackers_active
  ON public.client_strength_trackers(client_id, order_index)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_client_strength_trackers_exercise
  ON public.client_strength_trackers(exercise_id);

ALTER TABLE public.client_strength_trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own strength trackers" ON public.client_strength_trackers;
CREATE POLICY "Clients view own strength trackers"
  ON public.client_strength_trackers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_strength_trackers.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage strength trackers" ON public.client_strength_trackers;
CREATE POLICY "Admins manage strength trackers"
  ON public.client_strength_trackers
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

REVOKE ALL ON TABLE public.client_strength_trackers FROM anon, authenticated;
GRANT SELECT ON TABLE public.client_strength_trackers TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_strength_tracker_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.client_profiles
  WHERE id = NEW.client_id
  FOR UPDATE;

  SELECT COUNT(*)
  INTO active_count
  FROM public.client_strength_trackers
  WHERE client_id = NEW.client_id
    AND is_active
    AND id <> NEW.id;

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'A client can have at most five active strength trackers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_strength_tracker_limit
  ON public.client_strength_trackers;
CREATE TRIGGER enforce_strength_tracker_limit
  BEFORE INSERT OR UPDATE OF client_id, is_active
  ON public.client_strength_trackers
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_strength_tracker_limit();
