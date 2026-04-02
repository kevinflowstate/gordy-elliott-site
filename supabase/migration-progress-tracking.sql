CREATE TABLE IF NOT EXISTS public.client_body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  measured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg DECIMAL(5,1),
  waist_cm DECIMAL(5,1),
  chest_cm DECIMAL(5,1),
  hips_cm DECIMAL(5,1),
  left_arm_cm DECIMAL(5,1),
  right_arm_cm DECIMAL(5,1),
  left_thigh_cm DECIMAL(5,1),
  right_thigh_cm DECIMAL(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_body_measurements_client ON public.client_body_measurements(client_id, measured_date DESC);

ALTER TABLE public.client_body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own measurements" ON public.client_body_measurements
  FOR ALL USING (client_id IN (SELECT id FROM public.client_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all measurements" ON public.client_body_measurements
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
