CREATE OR REPLACE FUNCTION public.resume_client_if_due(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  affected_rows INTEGER := 0;
BEGIN
  UPDATE public.client_profiles
  SET
    lifecycle_status = 'active',
    lifecycle_paused_at = NULL,
    lifecycle_resumes_at = NULL
  WHERE id = p_client_id
    AND lifecycle_status IN ('paused', 'access_frozen')
    AND lifecycle_resumes_at IS NOT NULL
    AND lifecycle_resumes_at <= NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 1 THEN
    DELETE FROM public.client_lifecycle_notes WHERE client_id = p_client_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_client_if_due(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_client_if_due(UUID) TO service_role;
