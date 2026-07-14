CREATE OR REPLACE FUNCTION public.resume_client_if_due(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  resumed BOOLEAN := false;
BEGIN
  UPDATE public.client_profiles
  SET
    lifecycle_status = 'active',
    lifecycle_paused_at = NULL,
    lifecycle_resumes_at = NULL
  WHERE id = p_client_id
    AND lifecycle_status IN ('paused', 'access_frozen')
    AND lifecycle_resumes_at IS NOT NULL
    AND lifecycle_resumes_at <= NOW()
  RETURNING true INTO resumed;

  IF resumed THEN
    DELETE FROM public.client_lifecycle_notes WHERE client_id = p_client_id;
  END IF;

  RETURN resumed;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_client_if_due(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_client_if_due(UUID) TO service_role;
