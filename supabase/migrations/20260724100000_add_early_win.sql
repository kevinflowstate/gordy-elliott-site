CREATE TABLE IF NOT EXISTS public.client_early_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL CHECK (metric_key IN ('hrv_ms', 'resting_hr_bpm', 'sleep_minutes', 'weight_kg', 'waist_cm', 'manual')),
  source TEXT NOT NULL CHECK (source IN ('wearable', 'body_measurement', 'manual')),
  display_label TEXT NOT NULL CHECK (char_length(display_label) BETWEEN 1 AND 80),
  unit TEXT NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  starting_value NUMERIC(10,2) NOT NULL CHECK (starting_value BETWEEN -100000 AND 100000),
  target_value NUMERIC(10,2) NOT NULL CHECK (target_value BETWEEN -100000 AND 100000),
  start_date DATE NOT NULL,
  coaching_note TEXT CHECK (coaching_note IS NULL OR char_length(coaching_note) <= 500),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  review_outcome TEXT CHECK (review_outcome IS NULL OR char_length(review_outcome) <= 1000),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (metric_key = 'manual' AND source = 'manual')
    OR (metric_key IN ('hrv_ms', 'resting_hr_bpm', 'sleep_minutes') AND source = 'wearable')
    OR (metric_key IN ('weight_kg', 'waist_cm') AND source = 'body_measurement')
  ),
  CHECK (
    (status = 'active' AND reviewed_at IS NULL AND review_outcome IS NULL)
    OR (status = 'completed' AND reviewed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_early_wins_one_active
  ON public.client_early_wins(client_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_client_early_wins_client
  ON public.client_early_wins(client_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_early_wins_reviewed_by
  ON public.client_early_wins(reviewed_by);

CREATE TABLE IF NOT EXISTS public.client_early_win_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  early_win_id UUID NOT NULL REFERENCES public.client_early_wins(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  value NUMERIC(10,2) NOT NULL CHECK (value BETWEEN -100000 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (early_win_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_client_early_win_entries_win
  ON public.client_early_win_entries(early_win_id, entry_date DESC);

ALTER TABLE public.client_early_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_early_win_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own active early win" ON public.client_early_wins;
CREATE POLICY "Clients view own active early win"
  ON public.client_early_wins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_early_wins.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
        AND client_early_wins.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins manage early wins" ON public.client_early_wins;
CREATE POLICY "Admins manage early wins"
  ON public.client_early_wins
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Clients view own active early win entries" ON public.client_early_win_entries;
CREATE POLICY "Clients view own active early win entries"
  ON public.client_early_win_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_early_wins
      JOIN public.client_profiles ON client_profiles.id = client_early_wins.client_id
      WHERE client_early_wins.id = client_early_win_entries.early_win_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
        AND client_early_wins.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins manage early win entries" ON public.client_early_win_entries;
CREATE POLICY "Admins manage early win entries"
  ON public.client_early_win_entries
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

GRANT SELECT ON public.client_early_wins TO authenticated;
GRANT SELECT ON public.client_early_win_entries TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_completed_early_win_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed early wins are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_completed_early_win_update ON public.client_early_wins;
CREATE TRIGGER prevent_completed_early_win_update
  BEFORE UPDATE ON public.client_early_wins
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_completed_early_win_change();
