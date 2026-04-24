CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS public.checkin_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS checkin_form_id UUID REFERENCES public.checkin_forms(id) ON DELETE SET NULL;
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS checkin_form_id UUID REFERENCES public.checkin_forms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_checkin_forms_is_default ON public.checkin_forms(is_default);
CREATE INDEX IF NOT EXISTS idx_client_profiles_checkin_form_id ON public.client_profiles(checkin_form_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checkin_form_id ON public.checkins(checkin_form_id);
ALTER TABLE public.checkin_forms ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'checkin_forms'
      AND policyname = 'Admins can manage checkin forms'
  ) THEN
    CREATE POLICY "Admins can manage checkin forms" ON public.checkin_forms
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'checkin_forms'
      AND policyname = 'Authenticated users can read checkin forms'
  ) THEN
    CREATE POLICY "Authenticated users can read checkin forms" ON public.checkin_forms
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
INSERT INTO public.checkin_forms (name, config, is_default)
SELECT
  COALESCE(form_config.config->>'title', 'Weekly Check-in') AS name,
  form_config.config,
  true
FROM public.form_config AS form_config
WHERE form_config.form_type = 'checkin'
  AND NOT EXISTS (SELECT 1 FROM public.checkin_forms)
ON CONFLICT DO NOTHING;
WITH default_form AS (
  SELECT id
  FROM public.checkin_forms
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1
)
UPDATE public.client_profiles
SET checkin_form_id = default_form.id
FROM default_form
WHERE public.client_profiles.checkin_form_id IS NULL;
WITH default_form AS (
  SELECT id
  FROM public.checkin_forms
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1
)
UPDATE public.checkins
SET checkin_form_id = default_form.id
FROM default_form
WHERE public.checkins.checkin_form_id IS NULL;
