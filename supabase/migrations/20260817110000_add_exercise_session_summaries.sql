CREATE TABLE IF NOT EXISTS public.client_exercise_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.client_exercise_sessions(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 21600),
  total_tonnage_kg NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_tonnage_kg BETWEEN 0 AND 10000000),
  completed_sets INTEGER NOT NULL DEFAULT 0 CHECK (completed_sets BETWEEN 0 AND 1000),
  total_reps INTEGER NOT NULL DEFAULT 0 CHECK (total_reps BETWEEN 0 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, session_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_exercise_session_summaries_client_date
  ON public.client_exercise_session_summaries(client_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_session_summaries_session_date
  ON public.client_exercise_session_summaries(session_id, log_date DESC);

ALTER TABLE public.client_exercise_session_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own exercise session summaries"
  ON public.client_exercise_session_summaries;
CREATE POLICY "Clients view own exercise session summaries"
  ON public.client_exercise_session_summaries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_exercise_session_summaries.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage exercise session summaries"
  ON public.client_exercise_session_summaries;
CREATE POLICY "Admins manage exercise session summaries"
  ON public.client_exercise_session_summaries
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

REVOKE ALL ON TABLE public.client_exercise_session_summaries FROM anon, authenticated;
GRANT SELECT ON TABLE public.client_exercise_session_summaries TO authenticated;
GRANT ALL ON TABLE public.client_exercise_session_summaries TO service_role;
