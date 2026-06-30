DO $$
BEGIN
  IF to_regclass('public.ai_usage') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can insert AI usage" ON public.ai_usage;
  END IF;
END $$;
