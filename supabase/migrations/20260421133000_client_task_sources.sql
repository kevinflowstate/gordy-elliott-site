-- Separate coach-assigned tasks from client-owned checklist items on the home hub.

ALTER TABLE public.client_tasks
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'coach';

ALTER TABLE public.client_tasks
  DROP CONSTRAINT IF EXISTS client_tasks_source_check;

ALTER TABLE public.client_tasks
  ADD CONSTRAINT client_tasks_source_check
  CHECK (source IN ('coach', 'client'));

UPDATE public.client_tasks
SET source = 'coach'
WHERE source IS NULL;
