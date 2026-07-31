CREATE POLICY "No direct client access to native push devices"
  ON public.native_push_devices
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by
  ON public.client_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_exercise_plans_template
  ON public.client_exercise_plans (template_id);
CREATE INDEX IF NOT EXISTS idx_client_exercise_session_items_exercise
  ON public.client_exercise_session_items (exercise_id);
CREATE INDEX IF NOT EXISTS idx_client_meal_tracking_meal
  ON public.client_meal_tracking (meal_id);
CREATE INDEX IF NOT EXISTS idx_client_modules_module
  ON public.client_modules (module_id);
CREATE INDEX IF NOT EXISTS idx_client_nutrition_meal_items_food
  ON public.client_nutrition_meal_items (food_id);
CREATE INDEX IF NOT EXISTS idx_client_nutrition_plans_template
  ON public.client_nutrition_plans (template_id);
CREATE INDEX IF NOT EXISTS idx_client_training_weekly_assignments_session
  ON public.client_training_weekly_assignments (session_id);
CREATE INDEX IF NOT EXISTS idx_client_wearable_events_connection
  ON public.client_wearable_events (connection_id);
CREATE INDEX IF NOT EXISTS idx_content_progress_content
  ON public.content_progress (content_id);
CREATE INDEX IF NOT EXISTS idx_exercise_training_session_items_exercise
  ON public.exercise_training_session_items (exercise_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_sender_user
  ON public.inbox_messages (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_template_meal_items_food
  ON public.nutrition_template_meal_items (food_id);

ALTER TABLE public.client_body_measurements
  DROP CONSTRAINT IF EXISTS client_body_measurements_client_date_unique;
DROP INDEX IF EXISTS public.idx_client_body_measurements_unique_day;
