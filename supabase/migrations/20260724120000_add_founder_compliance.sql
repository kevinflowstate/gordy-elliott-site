CREATE TABLE IF NOT EXISTS public.client_call_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  call_date DATE NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('coaching_call', 'strategy_call')),
  attended BOOLEAN NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_call_attendance_client
  ON public.client_call_attendance(client_id, call_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_call_attendance_recorded_by
  ON public.client_call_attendance(recorded_by);

CREATE TABLE IF NOT EXISTS public.client_whatsapp_help (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL CHECK (week_key ~ '^\d{4}-W\d{2}$'),
  helped BOOLEAN NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, week_key)
);

CREATE INDEX IF NOT EXISTS idx_client_whatsapp_help_recorded_by
  ON public.client_whatsapp_help(recorded_by);

-- Programme-level guarantee definition. A single row, all threshold fields
-- empty until Gordy confirms the commercial definition. While any field is
-- null nothing is evaluated and nothing is shown to clients - there are no
-- default thresholds.
CREATE TABLE IF NOT EXISTS public.guarantee_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  metric_key TEXT CHECK (metric_key IS NULL OR metric_key IN ('hrv_ms', 'resting_hr_bpm', 'sleep_minutes', 'sleep_score', 'weight_kg', 'body_fat_percentage', 'waist_cm')),
  comparison TEXT CHECK (comparison IS NULL OR comparison IN ('increase_at_least', 'decrease_at_least')),
  threshold_type TEXT CHECK (threshold_type IS NULL OR threshold_type IN ('absolute', 'percent')),
  threshold_value NUMERIC(10,2) CHECK (threshold_value IS NULL OR threshold_value > 0),
  remedy_text TEXT CHECK (remedy_text IS NULL OR char_length(remedy_text) <= 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.guarantee_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.client_call_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_whatsapp_help ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guarantee_settings ENABLE ROW LEVEL SECURITY;

-- These are Gordy's own operational records. There is no client-facing read
-- surface in v1, so no client SELECT policy exists on any of these tables.
DROP POLICY IF EXISTS "Admins manage call attendance" ON public.client_call_attendance;
CREATE POLICY "Admins manage call attendance"
  ON public.client_call_attendance
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins manage whatsapp help records" ON public.client_whatsapp_help;
CREATE POLICY "Admins manage whatsapp help records"
  ON public.client_whatsapp_help
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins manage guarantee settings" ON public.guarantee_settings;
CREATE POLICY "Admins manage guarantee settings"
  ON public.guarantee_settings
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

-- No grants to authenticated: these tables are admin-only and reached solely
-- through service-role API routes. RLS default-deny plus absent grants makes
-- the intent explicit.
