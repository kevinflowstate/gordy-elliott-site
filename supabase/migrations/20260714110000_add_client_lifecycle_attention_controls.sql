ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS lifecycle_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_resumes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_note TEXT;

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_lifecycle_status_check;

ALTER TABLE public.client_profiles
  ADD CONSTRAINT client_profiles_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'paused', 'access_frozen'));

CREATE INDEX IF NOT EXISTS idx_client_profiles_lifecycle_status
  ON public.client_profiles(lifecycle_status);

CREATE TABLE IF NOT EXISTS public.client_monitoring_preferences (
  client_id UUID PRIMARY KEY REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  monitor_login BOOLEAN NOT NULL DEFAULT true,
  monitor_checkins BOOLEAN NOT NULL DEFAULT true,
  monitor_training BOOLEAN NOT NULL DEFAULT false,
  monitor_daily_metrics BOOLEAN NOT NULL DEFAULT false,
  monitor_nutrition BOOLEAN NOT NULL DEFAULT false,
  monitor_wearables BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_attention_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  signal TEXT NOT NULL CHECK (signal IN ('login', 'checkin', 'training', 'daily_metrics', 'nutrition', 'wearables')),
  ignored BOOLEAN NOT NULL DEFAULT false,
  snoozed_until TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, signal)
);

CREATE INDEX IF NOT EXISTS idx_client_attention_snoozes_client
  ON public.client_attention_snoozes(client_id);

ALTER TABLE public.client_monitoring_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_attention_snoozes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_monitoring_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_attention_snoozes TO authenticated;

DROP POLICY IF EXISTS "Admins manage client monitoring preferences" ON public.client_monitoring_preferences;
CREATE POLICY "Admins manage client monitoring preferences"
  ON public.client_monitoring_preferences
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins manage client attention snoozes" ON public.client_attention_snoozes;
CREATE POLICY "Admins manage client attention snoozes"
  ON public.client_attention_snoozes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));
