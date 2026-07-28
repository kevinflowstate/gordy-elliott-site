-- Storm Warning: audit log of warning evaluations + client dismissals.
--
-- Two tables rather than one: warning rows are an append-only audit trail
-- written by the server (service role), while dismissals are a client action
-- keyed to a warning window. Mixing them would give clients update rights on
-- audit rows. Warning rows are deduplicated on (client_id, window_key,
-- input_hash) so repeated evaluations of the same inputs never spam the log.

CREATE TABLE IF NOT EXISTS public.client_storm_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  window_key TEXT NOT NULL CHECK (window_key ~ '^\d{4}-W\d{2}$'),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('amber', 'red')),
  triggered_rules TEXT[] NOT NULL CHECK (array_length(triggered_rules, 1) >= 1),
  evaluation JSONB NOT NULL,
  input_hash TEXT NOT NULL CHECK (char_length(input_hash) BETWEEN 8 AND 64),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end >= window_start),
  UNIQUE (client_id, window_key, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_client_storm_warnings_client_window
  ON public.client_storm_warnings(client_id, window_key, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_storm_warnings_evaluated
  ON public.client_storm_warnings(evaluated_at DESC);

CREATE TABLE IF NOT EXISTS public.client_storm_warning_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  window_key TEXT NOT NULL CHECK (window_key ~ '^\d{4}-W\d{2}$'),
  severity TEXT NOT NULL CHECK (severity IN ('amber', 'red')),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, window_key)
);

CREATE INDEX IF NOT EXISTS idx_client_storm_warning_dismissals_window
  ON public.client_storm_warning_dismissals(window_key);

ALTER TABLE public.client_storm_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_storm_warning_dismissals ENABLE ROW LEVEL SECURITY;

-- Warning log: clients read their own (Founder mode); only the server writes
-- (service role bypasses RLS), and admins have full access.
DROP POLICY IF EXISTS "Clients view own storm warnings" ON public.client_storm_warnings;
CREATE POLICY "Clients view own storm warnings"
  ON public.client_storm_warnings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_storm_warnings.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
    )
  );

DROP POLICY IF EXISTS "Admins manage storm warnings" ON public.client_storm_warnings;
CREATE POLICY "Admins manage storm warnings"
  ON public.client_storm_warnings
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

-- Dismissals: clients read and record their own (Founder mode); admins full.
DROP POLICY IF EXISTS "Clients view own storm warning dismissals" ON public.client_storm_warning_dismissals;
CREATE POLICY "Clients view own storm warning dismissals"
  ON public.client_storm_warning_dismissals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_storm_warning_dismissals.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
    )
  );

-- Dismissal writes are API-only (service role): the portal route validates
-- every dismissal against a fresh server-side evaluation before writing.
-- Direct client INSERT/UPDATE would allow pre-silencing arbitrary future
-- window keys, so clients hold SELECT only.
DROP POLICY IF EXISTS "Clients dismiss own storm warnings" ON public.client_storm_warning_dismissals;
DROP POLICY IF EXISTS "Clients update own storm warning dismissals" ON public.client_storm_warning_dismissals;

DROP POLICY IF EXISTS "Admins manage storm warning dismissals" ON public.client_storm_warning_dismissals;
CREATE POLICY "Admins manage storm warning dismissals"
  ON public.client_storm_warning_dismissals
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

-- Production may carry permissive default ACLs for newly-created public
-- tables. Reset them before granting the one intended client capability.
REVOKE ALL ON TABLE public.client_storm_warnings, public.client_storm_warning_dismissals
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.client_storm_warnings, public.client_storm_warning_dismissals
  TO authenticated;

-- Calendar edits change the input hash, so retention must be enforced at the
-- write boundary rather than in a caller. A transaction-scoped advisory lock
-- serialises writers for one client/window, making the 30-row cap atomic
-- across portal evaluations and Gordy's batch Capacity Scan.
CREATE OR REPLACE FUNCTION public.log_client_storm_warning(
  p_client_id UUID,
  p_window_key TEXT,
  p_window_start DATE,
  p_window_end DATE,
  p_severity TEXT,
  p_triggered_rules TEXT[],
  p_evaluation JSONB,
  p_input_hash TEXT,
  p_evaluated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_id::text || ':' || p_window_key, 0)
  );

  IF (
    SELECT count(*)
    FROM public.client_storm_warnings
    WHERE client_id = p_client_id
      AND window_key = p_window_key
  ) >= 30 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.client_storm_warnings (
    client_id,
    window_key,
    window_start,
    window_end,
    severity,
    triggered_rules,
    evaluation,
    input_hash,
    evaluated_at
  )
  VALUES (
    p_client_id,
    p_window_key,
    p_window_start,
    p_window_end,
    p_severity,
    p_triggered_rules,
    p_evaluation,
    p_input_hash,
    p_evaluated_at
  )
  ON CONFLICT (client_id, window_key, input_hash) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.log_client_storm_warning(
  UUID, TEXT, DATE, DATE, TEXT, TEXT[], JSONB, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_client_storm_warning(
  UUID, TEXT, DATE, DATE, TEXT, TEXT[], JSONB, TEXT, TIMESTAMPTZ
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_client_storm_warning(
  UUID, TEXT, DATE, DATE, TEXT, TEXT[], JSONB, TEXT, TIMESTAMPTZ
) TO service_role;
