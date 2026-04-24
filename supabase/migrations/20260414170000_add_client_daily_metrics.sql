CREATE TABLE IF NOT EXISTS public.client_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  tracked_date DATE NOT NULL,
  sleep_hours NUMERIC(4,1),
  water_liters NUMERIC(4,1),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  nutrition_score INTEGER CHECK (nutrition_score BETWEEN 1 AND 10),
  training_completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, tracked_date)
);
CREATE INDEX IF NOT EXISTS idx_client_daily_metrics_client_date
  ON public.client_daily_metrics(client_id, tracked_date DESC);
ALTER TABLE public.client_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own daily metrics" ON public.client_daily_metrics
  FOR ALL USING (
    client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins can view all daily metrics" ON public.client_daily_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
