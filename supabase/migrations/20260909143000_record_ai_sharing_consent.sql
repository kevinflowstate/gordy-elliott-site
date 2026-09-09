-- No existing account is opted in. Only authenticated, owner-scoped server
-- routes may record a decision; profile editing cannot grant AI permission.
CREATE TABLE public.client_ai_consent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_ai_consent_events_latest_idx
  ON public.client_ai_consent_events (client_id, id DESC);
ALTER TABLE public.client_ai_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_ai_consent_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.client_ai_consent_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.client_ai_consent_events_id_seq TO service_role;

CREATE VIEW public.client_ai_consent_state WITH (security_invoker = true) AS
  SELECT DISTINCT ON (client_id) client_id, user_id, consent_version, granted, created_at
  FROM public.client_ai_consent_events
  ORDER BY client_id, id DESC;
REVOKE ALL ON public.client_ai_consent_state FROM anon, authenticated;
GRANT SELECT ON public.client_ai_consent_state TO service_role;
