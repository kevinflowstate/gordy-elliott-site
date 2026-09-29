-- Keep a client plan's overview independent from later template edits.
ALTER TABLE public.client_exercise_plans
  ADD COLUMN IF NOT EXISTS overview text;

-- Existing assigned plans inherit their template overview once. Coach-authored
-- plan overviews are preserved if this migration is re-run.
UPDATE public.client_exercise_plans AS plan
SET overview = template.overview
FROM public.exercise_training_templates AS template
WHERE plan.template_id = template.id
  AND NULLIF(BTRIM(plan.overview), '') IS NULL
  AND NULLIF(BTRIM(template.overview), '') IS NOT NULL;
