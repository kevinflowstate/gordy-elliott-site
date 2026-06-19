REVOKE ALL ON public.brain_ingestion_runs FROM anon, authenticated;
REVOKE ALL ON public.brain_docs FROM anon, authenticated;
REVOKE ALL ON public.brain_chunks FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_ingestion_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_docs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_chunks TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) TO service_role;
