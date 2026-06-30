-- Client-owned calendar reminders that sit alongside Gordy's coaching events.

CREATE TABLE IF NOT EXISTS public.client_personal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  event_date_key DATE NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  event_time TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_day INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_personal_events_category_check
    CHECK (category IN ('wedding', 'anniversary', 'birthday', 'travel', 'reminder', 'custom')),
  CONSTRAINT client_personal_events_recurrence_check
    CHECK (recurrence IN ('none', 'weekly', 'biweekly', 'monthly'))
);

CREATE INDEX IF NOT EXISTS idx_client_personal_events_client_date
  ON public.client_personal_events(client_id, event_date);

ALTER TABLE public.client_personal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own personal events" ON public.client_personal_events
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM public.client_profiles
      WHERE user_id = auth.uid()
        AND COALESCE(tier, 'coached') <> 'ai_only'
    )
  );

CREATE POLICY "Clients can create own personal events" ON public.client_personal_events
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM public.client_profiles
      WHERE user_id = auth.uid()
        AND COALESCE(tier, 'coached') <> 'ai_only'
    )
  );

CREATE POLICY "Clients can update own personal events" ON public.client_personal_events
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM public.client_profiles
      WHERE user_id = auth.uid()
        AND COALESCE(tier, 'coached') <> 'ai_only'
    )
  ) WITH CHECK (
    client_id IN (
      SELECT id FROM public.client_profiles
      WHERE user_id = auth.uid()
        AND COALESCE(tier, 'coached') <> 'ai_only'
    )
  );

CREATE POLICY "Clients can delete own personal events" ON public.client_personal_events
  FOR DELETE USING (
    client_id IN (
      SELECT id FROM public.client_profiles
      WHERE user_id = auth.uid()
        AND COALESCE(tier, 'coached') <> 'ai_only'
    )
  );

CREATE POLICY "Admins can manage all personal events" ON public.client_personal_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );;
