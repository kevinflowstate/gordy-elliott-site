CREATE TABLE IF NOT EXISTS public.client_training_weekly_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.client_exercise_plans(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.client_exercise_sessions(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  planned_date date,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, plan_id, session_id, week_start),
  CHECK (planned_date IS NULL OR planned_date >= week_start),
  CHECK (planned_date IS NULL OR planned_date <= week_start + 6)
);

CREATE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_client_week
  ON public.client_training_weekly_assignments(client_id, week_start);

CREATE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_plan_week
  ON public.client_training_weekly_assignments(plan_id, week_start);

CREATE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_recurring
  ON public.client_training_weekly_assignments(client_id, plan_id, session_id, is_recurring, week_start);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_unique_day
  ON public.client_training_weekly_assignments(client_id, plan_id, week_start, planned_date)
  WHERE planned_date IS NOT NULL;

ALTER TABLE public.client_training_weekly_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      JOIN public.client_exercise_plans p
        ON p.id = client_training_weekly_assignments.plan_id
       AND p.client_id = cp.id
      JOIN public.client_exercise_sessions s
        ON s.id = client_training_weekly_assignments.session_id
       AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "clients_insert_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      JOIN public.client_exercise_plans p
        ON p.id = client_training_weekly_assignments.plan_id
       AND p.client_id = cp.id
      JOIN public.client_exercise_sessions s
        ON s.id = client_training_weekly_assignments.session_id
       AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "clients_update_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      JOIN public.client_exercise_plans p
        ON p.id = client_training_weekly_assignments.plan_id
       AND p.client_id = cp.id
      JOIN public.client_exercise_sessions s
        ON s.id = client_training_weekly_assignments.session_id
       AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id
        AND cp.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      JOIN public.client_exercise_plans p
        ON p.id = client_training_weekly_assignments.plan_id
       AND p.client_id = cp.id
      JOIN public.client_exercise_sessions s
        ON s.id = client_training_weekly_assignments.session_id
       AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "clients_delete_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      JOIN public.client_exercise_plans p
        ON p.id = client_training_weekly_assignments.plan_id
       AND p.client_id = cp.id
      JOIN public.client_exercise_sessions s
        ON s.id = client_training_weekly_assignments.session_id
       AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_training_weekly_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_training_weekly_assignments TO service_role;
