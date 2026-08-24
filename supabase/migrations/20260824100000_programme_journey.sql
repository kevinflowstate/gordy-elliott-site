-- Programme entitlements, onboarding activation, monthly coaching calls,
-- Education Hub audiences and the SHIFT AI monthly allowance.

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS programme_type text NOT NULL DEFAULT 'capacity',
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Preserve the intent of the legacy tiers for existing demo/client records.
-- New clients are assigned explicitly by the invite route.
UPDATE public.client_profiles
SET programme_type = CASE
  WHEN experience_mode = 'founder_dashboard' OR tier = 'vip' THEN 'capacity'
  WHEN tier = 'premium' THEN 'in_person'
  ELSE 'shift'
END,
tier = CASE
  WHEN experience_mode = 'founder_dashboard' OR tier = 'vip' THEN 'vip'
  WHEN tier = 'premium' THEN 'premium'
  ELSE 'coached'
END,
experience_mode = CASE
  WHEN experience_mode = 'founder_dashboard' OR tier = 'vip' THEN 'founder_dashboard'
  ELSE 'ai_coaching'
END;

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_programme_type_check;
ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_programme_type_check
  CHECK (programme_type IN ('capacity', 'shift', 'in_person'));

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_onboarding_status_check;
ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_onboarding_status_check
  CHECK (onboarding_status IN ('invited', 'consultation_complete', 'active', 'paused'));

UPDATE public.client_profiles
SET activated_at = COALESCE(activated_at, created_at)
WHERE onboarding_status = 'active' AND activated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_profiles_programme_onboarding
  ON public.client_profiles(programme_type, onboarding_status);

COMMENT ON COLUMN public.client_profiles.programme_type IS
  'Primary coaching programme: capacity, shift or in_person. Legacy tier remains during transition.';
COMMENT ON COLUMN public.client_profiles.onboarding_status IS
  'invited -> consultation_complete -> active. paused is reserved for manual access control.';

CREATE TABLE IF NOT EXISTS public.client_monthly_call_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  call_slot smallint NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_monthly_call_slot_check CHECK (call_slot IN (1, 2)),
  CONSTRAINT client_monthly_call_unique UNIQUE (client_id, month_start, call_slot)
);

CREATE INDEX IF NOT EXISTS idx_monthly_calls_client_month
  ON public.client_monthly_call_confirmations(client_id, month_start DESC);

ALTER TABLE public.client_monthly_call_confirmations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_monthly_call_confirmations TO authenticated;

DROP POLICY IF EXISTS "Clients can view own monthly call confirmations" ON public.client_monthly_call_confirmations;
CREATE POLICY "Clients can view own monthly call confirmations"
  ON public.client_monthly_call_confirmations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_monthly_call_confirmations.client_id
      AND cp.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Clients can confirm own monthly calls" ON public.client_monthly_call_confirmations;
CREATE POLICY "Clients can confirm own monthly calls"
  ON public.client_monthly_call_confirmations FOR INSERT TO authenticated
  WITH CHECK (
    month_start = date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London'))::date
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_monthly_call_confirmations.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND (
          (cp.programme_type = 'capacity' AND client_monthly_call_confirmations.call_slot IN (1, 2))
          OR (cp.programme_type IN ('shift', 'in_person') AND client_monthly_call_confirmations.call_slot = 1)
        )
    )
  );

DROP POLICY IF EXISTS "Admins can manage monthly call confirmations" ON public.client_monthly_call_confirmations;
CREATE POLICY "Admins can manage monthly call confirmations"
  ON public.client_monthly_call_confirmations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));

ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS hub_section text NOT NULL DEFAULT 'library',
  ADD COLUMN IF NOT EXISTS programme_audiences text[] NOT NULL DEFAULT ARRAY['capacity', 'shift', 'in_person']::text[];

ALTER TABLE public.training_modules
  DROP CONSTRAINT IF EXISTS training_modules_hub_section_check;
ALTER TABLE public.training_modules
  ADD CONSTRAINT training_modules_hub_section_check
  CHECK (hub_section IN ('library', 'current_coaching'));

ALTER TABLE public.training_modules
  DROP CONSTRAINT IF EXISTS training_modules_programme_audiences_check;
ALTER TABLE public.training_modules
  ADD CONSTRAINT training_modules_programme_audiences_check
  CHECK (
    cardinality(programme_audiences) > 0
    AND programme_audiences <@ ARRAY['capacity', 'shift', 'in_person']::text[]
  );

CREATE INDEX IF NOT EXISTS idx_training_modules_programme_audiences
  ON public.training_modules USING gin(programme_audiences);

INSERT INTO public.form_config (form_type, config)
VALUES ('programme_ai_allowances', '{"shift_monthly_interactions":30}'::jsonb)
ON CONFLICT (form_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.client_ai_monthly_usage (
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  successful_interactions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, month_start),
  CONSTRAINT client_ai_monthly_usage_nonnegative CHECK (successful_interactions >= 0)
);

ALTER TABLE public.client_ai_monthly_usage ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.client_ai_monthly_usage TO authenticated;

DROP POLICY IF EXISTS "Clients can view own monthly AI usage" ON public.client_ai_monthly_usage;
CREATE POLICY "Clients can view own monthly AI usage"
  ON public.client_ai_monthly_usage FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_ai_monthly_usage.client_id
      AND cp.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can view monthly AI usage" ON public.client_ai_monthly_usage;
CREATE POLICY "Admins can view monthly AI usage"
  ON public.client_ai_monthly_usage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.increment_client_ai_monthly_usage(
  p_client_id uuid,
  p_month_start date,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_limit < 1 THEN
    RAISE EXCEPTION 'AI interaction limit must be positive';
  END IF;

  INSERT INTO public.client_ai_monthly_usage(client_id, month_start, successful_interactions)
  VALUES (p_client_id, p_month_start, 1)
  ON CONFLICT (client_id, month_start) DO UPDATE
  SET successful_interactions = client_ai_monthly_usage.successful_interactions + 1,
      updated_at = now()
  WHERE client_ai_monthly_usage.successful_interactions < p_limit
  RETURNING successful_interactions INTO v_count;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'AI interaction limit reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_client_ai_monthly_usage(uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_client_ai_monthly_usage(uuid, date, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.decrement_client_ai_monthly_usage(
  p_client_id uuid,
  p_month_start date
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.client_ai_monthly_usage
  SET successful_interactions = GREATEST(0, successful_interactions - 1),
      updated_at = now()
  WHERE client_id = p_client_id AND month_start = p_month_start
  RETURNING successful_interactions;
$$;

REVOKE ALL ON FUNCTION public.decrement_client_ai_monthly_usage(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_client_ai_monthly_usage(uuid, date) TO service_role;

-- Documents are programme-controlled: CAPACITY and IN PERSON have full access.
DROP POLICY IF EXISTS "Clients can read own vip documents" ON public.client_documents;
DROP POLICY IF EXISTS "Clients can create own vip documents" ON public.client_documents;
DROP POLICY IF EXISTS "Clients can update own vip documents" ON public.client_documents;

CREATE POLICY "Eligible clients can read own documents" ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );

CREATE POLICY "Eligible clients can create own documents" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );

CREATE POLICY "Eligible clients can update own documents" ON public.client_documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_documents.client_id
      AND cp.user_id = (SELECT auth.uid())
      AND cp.programme_type IN ('capacity', 'in_person')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_documents.client_id
      AND cp.user_id = (SELECT auth.uid())
      AND cp.programme_type IN ('capacity', 'in_person')
  ));

DROP POLICY IF EXISTS "VIP clients can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can delete own documents" ON storage.objects;

CREATE POLICY "Eligible clients can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );

CREATE POLICY "Eligible clients can read own document objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );

CREATE POLICY "Eligible clients can update own document objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );

CREATE POLICY "Eligible clients can delete own document objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person')
    )
  );
