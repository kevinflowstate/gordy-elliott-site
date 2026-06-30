DROP POLICY IF EXISTS "clients_select_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments;
DROP POLICY IF EXISTS "clients_insert_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments;
DROP POLICY IF EXISTS "clients_update_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments;
DROP POLICY IF EXISTS "clients_delete_own_training_weekly_assignments"
  ON public.client_training_weekly_assignments;

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
