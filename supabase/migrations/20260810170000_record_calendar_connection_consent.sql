ALTER TABLE public.client_calendar_connections
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_calendar_connections.consent_version IS
  'Version of the AT CAPACITY calendar connection notice accepted before provider OAuth.';

COMMENT ON COLUMN public.client_calendar_connections.consented_at IS
  'When the client deliberately continued from the calendar connection notice.';
