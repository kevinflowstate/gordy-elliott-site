CREATE TABLE IF NOT EXISTS public.client_wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  terra_user_id TEXT,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'pending', 'error')),
  last_sync_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::JSONB,
  raw_user JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_wearable_connections_terra_user
  ON public.client_wearable_connections(terra_user_id)
  WHERE terra_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_wearable_connections_client
  ON public.client_wearable_connections(client_id, status);

CREATE TABLE IF NOT EXISTS public.client_wearable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.client_wearable_connections(id) ON DELETE SET NULL,
  terra_user_id TEXT,
  provider TEXT,
  event_type TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_wearable_events_client_received
  ON public.client_wearable_events(client_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_wearable_events_terra_user
  ON public.client_wearable_events(terra_user_id);

CREATE TABLE IF NOT EXISTS public.client_wearable_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  providers TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  sleep_minutes INTEGER,
  sleep_score INTEGER CHECK (sleep_score BETWEEN 0 AND 100),
  hrv_ms NUMERIC(8,2),
  resting_hr_bpm INTEGER,
  steps INTEGER,
  active_calories INTEGER,
  total_calories_burned INTEGER,
  training_load NUMERIC(8,2),
  workout_count INTEGER,
  nutrition_calories INTEGER,
  protein_g NUMERIC(8,2),
  carbs_g NUMERIC(8,2),
  fat_g NUMERIC(8,2),
  water_ml INTEGER,
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
  recovery_status TEXT NOT NULL DEFAULT 'good' CHECK (recovery_status IN ('good', 'watch', 'reduce_intensity')),
  flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  insight TEXT,
  source_payload_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_client_wearable_daily_summaries_client_date
  ON public.client_wearable_daily_summaries(client_id, summary_date DESC);

ALTER TABLE public.client_wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_wearable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_wearable_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own wearable connections" ON public.client_wearable_connections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_wearable_connections.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Clients can update own wearable connections" ON public.client_wearable_connections
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_wearable_connections.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_wearable_connections.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage all wearable connections" ON public.client_wearable_connections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

CREATE POLICY "Admins can view all wearable events" ON public.client_wearable_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

CREATE POLICY "Clients can view own wearable summaries" ON public.client_wearable_daily_summaries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_wearable_daily_summaries.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage all wearable summaries" ON public.client_wearable_daily_summaries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

GRANT SELECT, UPDATE ON public.client_wearable_connections TO authenticated;
GRANT SELECT ON public.client_wearable_events TO authenticated;
GRANT SELECT ON public.client_wearable_daily_summaries TO authenticated;
