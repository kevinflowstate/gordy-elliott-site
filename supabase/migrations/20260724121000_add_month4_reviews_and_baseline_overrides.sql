CREATE TABLE IF NOT EXISTS public.client_month4_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  baseline_comparison JSONB,
  compliance_summary JSONB,
  outcome_note TEXT CHECK (outcome_note IS NULL OR char_length(outcome_note) <= 1000),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'draft' AND completed_at IS NULL)
    OR (
      status = 'completed'
      AND completed_at IS NOT NULL
      AND baseline_comparison IS NOT NULL
      AND compliance_summary IS NOT NULL
      AND outcome_note IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_client_month4_reviews_completed_by
  ON public.client_month4_reviews(completed_by);

ALTER TABLE public.client_month4_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients view own completed month 4 review" ON public.client_month4_reviews;
CREATE POLICY "Clients view own completed month 4 review"
  ON public.client_month4_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles
      WHERE client_profiles.id = client_month4_reviews.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.experience_mode = 'founder_dashboard'
        AND client_month4_reviews.status = 'completed'
    )
  );

DROP POLICY IF EXISTS "Admins manage month 4 reviews" ON public.client_month4_reviews;
CREATE POLICY "Admins manage month 4 reviews"
  ON public.client_month4_reviews
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

GRANT SELECT ON public.client_month4_reviews TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_completed_month4_review_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed Month 4 reviews are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_completed_month4_review_update ON public.client_month4_reviews;
CREATE TRIGGER prevent_completed_month4_review_update
  BEFORE UPDATE ON public.client_month4_reviews
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_completed_month4_review_change();

-- Audit trail for explicit overrides of a locked baseline. One row per
-- override, holding the prior values, the replacement values, the written
-- reason, the actor and the timestamp, so a locked baseline can never
-- silently change.
CREATE TABLE IF NOT EXISTS public.client_baseline_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.client_capacity_baselines(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  actor UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_baseline_overrides_baseline
  ON public.client_baseline_overrides(baseline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_baseline_overrides_client
  ON public.client_baseline_overrides(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_baseline_overrides_actor
  ON public.client_baseline_overrides(actor);

ALTER TABLE public.client_baseline_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage baseline overrides" ON public.client_baseline_overrides;
CREATE POLICY "Admins manage baseline overrides"
  ON public.client_baseline_overrides
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

GRANT SELECT ON public.client_baseline_overrides TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_baseline_override_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Baseline override audit records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_baseline_override_audit_update ON public.client_baseline_overrides;
CREATE TRIGGER prevent_baseline_override_audit_update
  BEFORE UPDATE ON public.client_baseline_overrides
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_baseline_override_audit_change();

-- The lock trigger still rejects every ordinary write to a locked baseline.
-- The single exception is the audited override function below, which flags
-- its own transaction before it relocks the row.
CREATE OR REPLACE FUNCTION private.prevent_locked_capacity_baseline_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'locked'
    AND COALESCE(current_setting('app.capacity_baseline_override', true), '') <> 'allow' THEN
    RAISE EXCEPTION 'Locked capacity baselines are immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- Unlock, edit and relock in one audited transaction. Requires a written
-- reason; records prior and replacement values in client_baseline_overrides
-- before the row changes. Executable only by the service role - never by
-- authenticated clients.
CREATE OR REPLACE FUNCTION public.override_locked_capacity_baseline(
  p_client_id UUID,
  p_new_values JSONB,
  p_reason TEXT,
  p_actor UUID
)
RETURNS public.client_capacity_baselines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_baseline public.client_capacity_baselines%ROWTYPE;
  v_updated public.client_capacity_baselines%ROWTYPE;
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_reason = '' THEN
    RAISE EXCEPTION 'An override reason is required';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'The override reason is limited to 500 characters';
  END IF;

  SELECT * INTO v_baseline
  FROM public.client_capacity_baselines
  WHERE client_id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No baseline exists for this client';
  END IF;
  IF v_baseline.status <> 'locked' THEN
    RAISE EXCEPTION 'Only a locked baseline can be overridden';
  END IF;
  IF (p_new_values->>'period_start') IS NULL OR (p_new_values->>'period_end') IS NULL THEN
    RAISE EXCEPTION 'The override must state its baseline period';
  END IF;
  IF (p_new_values->>'hrv_ms') IS NULL
    AND (p_new_values->>'resting_hr_bpm') IS NULL
    AND (p_new_values->>'sleep_minutes') IS NULL
    AND (p_new_values->>'sleep_score') IS NULL
    AND (p_new_values->>'weight_kg') IS NULL
    AND (p_new_values->>'body_fat_percentage') IS NULL
    AND (p_new_values->>'waist_cm') IS NULL THEN
    RAISE EXCEPTION 'At least one baseline metric is required';
  END IF;

  INSERT INTO public.client_baseline_overrides (baseline_id, client_id, old_values, new_values, reason, actor)
  VALUES (
    v_baseline.id,
    v_baseline.client_id,
    jsonb_build_object(
      'period_start', v_baseline.period_start,
      'period_end', v_baseline.period_end,
      'hrv_ms', v_baseline.hrv_ms,
      'resting_hr_bpm', v_baseline.resting_hr_bpm,
      'sleep_minutes', v_baseline.sleep_minutes,
      'sleep_score', v_baseline.sleep_score,
      'weight_kg', v_baseline.weight_kg,
      'body_fat_percentage', v_baseline.body_fat_percentage,
      'waist_cm', v_baseline.waist_cm,
      'wearable_source_days', v_baseline.wearable_source_days,
      'locked_at', v_baseline.locked_at,
      'override_reason', v_baseline.override_reason
    ),
    p_new_values,
    v_reason,
    p_actor
  );

  PERFORM set_config('app.capacity_baseline_override', 'allow', true);

  UPDATE public.client_capacity_baselines SET
    period_start = (p_new_values->>'period_start')::date,
    period_end = (p_new_values->>'period_end')::date,
    hrv_ms = (p_new_values->>'hrv_ms')::numeric,
    resting_hr_bpm = (p_new_values->>'resting_hr_bpm')::numeric,
    sleep_minutes = (p_new_values->>'sleep_minutes')::numeric,
    sleep_score = (p_new_values->>'sleep_score')::numeric,
    weight_kg = (p_new_values->>'weight_kg')::numeric,
    body_fat_percentage = (p_new_values->>'body_fat_percentage')::numeric,
    waist_cm = (p_new_values->>'waist_cm')::numeric,
    wearable_source_days = COALESCE((p_new_values->>'wearable_source_days')::integer, 0),
    status = 'locked',
    locked_at = v_now,
    locked_by = p_actor,
    override_reason = v_reason,
    updated_at = v_now
  WHERE id = v_baseline.id
  RETURNING * INTO v_updated;

  PERFORM set_config('app.capacity_baseline_override', 'off', true);

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.override_locked_capacity_baseline(UUID, JSONB, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.override_locked_capacity_baseline(UUID, JSONB, TEXT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.override_locked_capacity_baseline(UUID, JSONB, TEXT, UUID) TO service_role;
