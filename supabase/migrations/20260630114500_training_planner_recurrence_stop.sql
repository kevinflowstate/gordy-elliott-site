ALTER TABLE public.client_training_weekly_assignments
  ADD COLUMN IF NOT EXISTS recurrence_stopped boolean NOT NULL DEFAULT false;
