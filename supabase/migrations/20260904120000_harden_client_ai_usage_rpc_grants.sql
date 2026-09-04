-- Keep the monthly AI usage mutation RPCs server-side only.
-- Repeating these permission statements is safe and preserves service-role access.

REVOKE EXECUTE ON FUNCTION public.increment_client_ai_monthly_usage(uuid, date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_client_ai_monthly_usage(uuid, date, integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.decrement_client_ai_monthly_usage(uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_client_ai_monthly_usage(uuid, date)
  TO service_role;
