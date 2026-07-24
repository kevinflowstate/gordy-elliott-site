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

DROP POLICY IF EXISTS "Clients dismiss own storm warnings" ON public.client_storm_warning_dismissals;
CREATE POLICY "Clients dismiss own storm warnings"
  ON public.client_storm_warning_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_storm_warning_dismissals.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
    )
  );

DROP POLICY IF EXISTS "Clients update own storm warning dismissals" ON public.client_storm_warning_dismissals;
CREATE POLICY "Clients update own storm warning dismissals"
  ON public.client_storm_warning_dismissals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_storm_warning_dismissals.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_storm_warning_dismissals.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
    )
  );

DROP POLICY IF EXISTS "Admins manage storm warning dismissals" ON public.client_storm_warning_dismissals;
CREATE POLICY "Admins manage storm warning dismissals"
  ON public.client_storm_warning_dismissals
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

GRANT SELECT ON public.client_storm_warnings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_storm_warning_dismissals TO authenticated;
