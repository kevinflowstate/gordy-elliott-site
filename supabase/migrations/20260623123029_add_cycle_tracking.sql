ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('female', 'male', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS cycle_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.client_cycle_settings (
  client_id UUID PRIMARY KEY REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  last_period_start DATE,
  average_cycle_length INTEGER NOT NULL DEFAULT 28 CHECK (average_cycle_length BETWEEN 21 AND 45),
  average_period_length INTEGER NOT NULL DEFAULT 5 CHECK (average_period_length BETWEEN 2 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_cycle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  tracked_date DATE NOT NULL,
  flow TEXT NOT NULL DEFAULT 'none' CHECK (flow IN ('none', 'spotting', 'light', 'medium', 'heavy')),
  symptoms TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  training_impact TEXT NOT NULL DEFAULT 'none' CHECK (training_impact IN ('none', 'scaled', 'skipped')),
  unusual_symptoms BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, tracked_date)
);

CREATE TABLE IF NOT EXISTS public.client_cycle_prompt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  prompt_kind TEXT NOT NULL,
  phase TEXT,
  shown_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_client_cycle_entries_client_date
  ON public.client_cycle_entries(client_id, tracked_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_cycle_prompt_events_client_date
  ON public.client_cycle_prompt_events(client_id, shown_on DESC);

ALTER TABLE public.client_cycle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cycle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_cycle_prompt_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own cycle settings" ON public.client_cycle_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_settings.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_settings.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  );

CREATE POLICY "Admins can manage all cycle settings" ON public.client_cycle_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

CREATE POLICY "Clients can manage own cycle entries" ON public.client_cycle_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_entries.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_entries.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  );

CREATE POLICY "Admins can manage all cycle entries" ON public.client_cycle_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

CREATE POLICY "Clients can manage own cycle prompt events" ON public.client_cycle_prompt_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_prompt_events.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_cycle_prompt_events.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
        AND client_profiles.sex = 'female'
        AND client_profiles.cycle_tracking_enabled = TRUE
    )
  );

CREATE POLICY "Admins can manage all cycle prompt events" ON public.client_cycle_prompt_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_cycle_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_cycle_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_cycle_prompt_events TO authenticated;
