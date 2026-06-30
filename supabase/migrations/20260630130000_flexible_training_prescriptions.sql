ALTER TABLE public.exercise_training_session_items
  ADD COLUMN IF NOT EXISTS prescription_type text NOT NULL DEFAULT 'sets_reps'
    CHECK (prescription_type IN ('sets_reps', 'time', 'calories', 'rounds', 'amrap', 'distance', 'custom')),
  ADD COLUMN IF NOT EXISTS prescription_text text;

ALTER TABLE public.client_exercise_session_items
  ADD COLUMN IF NOT EXISTS prescription_type text NOT NULL DEFAULT 'sets_reps'
    CHECK (prescription_type IN ('sets_reps', 'time', 'calories', 'rounds', 'amrap', 'distance', 'custom')),
  ADD COLUMN IF NOT EXISTS prescription_text text;

UPDATE public.exercise_training_session_items
SET prescription_type = 'sets_reps'
WHERE prescription_type IS NULL;

UPDATE public.client_exercise_session_items
SET prescription_type = 'sets_reps'
WHERE prescription_type IS NULL;
