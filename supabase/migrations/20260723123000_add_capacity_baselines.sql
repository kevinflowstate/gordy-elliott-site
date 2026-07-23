CREATE TABLE IF NOT EXISTS public.client_capacity_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hrv_ms NUMERIC(7,1),
  resting_hr_bpm NUMERIC(6,1),
  sleep_minutes NUMERIC(7,1),
  sleep_score NUMERIC(6,1),
  weight_kg NUMERIC(7,2),
  body_fat_percentage NUMERIC(5,2),
  waist_cm NUMERIC(6,2),
  wearable_source_days INTEGER NOT NULL DEFAULT 0 CHECK (wearable_source_days >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  override_reason TEXT CHECK (override_reason IS NULL OR char_length(override_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start),
  CHECK (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 400),
  CHECK (body_fat_percentage IS NULL OR body_fat_percentage BETWEEN 1 AND 75),
  CHECK (waist_cm IS NULL OR waist_cm BETWEEN 30 AND 250),
  CHECK (
    (status = 'draft' AND locked_at IS NULL)
    OR (status = 'locked' AND locked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_client_capacity_baselines_status
  ON public.client_capacity_baselines(status, period_end DESC);

ALTER TABLE public.client_capacity_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own capacity baseline" ON public.client_capacity_baselines;
CREATE POLICY "Clients view own capacity baseline"
  ON public.client_capacity_baselines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_capacity_baselines.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
        AND client_capacity_baselines.status = 'locked'
    )
  );

DROP POLICY IF EXISTS "Admins manage capacity baselines" ON public.client_capacity_baselines;
CREATE POLICY "Admins manage capacity baselines"
  ON public.client_capacity_baselines
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

GRANT SELECT ON public.client_capacity_baselines TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_locked_capacity_baseline_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Locked capacity baselines are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_capacity_baseline_update ON public.client_capacity_baselines;
CREATE TRIGGER prevent_locked_capacity_baseline_update
  BEFORE UPDATE ON public.client_capacity_baselines
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_locked_capacity_baseline_change();
