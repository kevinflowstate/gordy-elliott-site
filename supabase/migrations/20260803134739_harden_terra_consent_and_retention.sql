ALTER TABLE public.client_wearable_connections
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_wearable_connections.consent_version IS
  'Version of the connection-point health data notice accepted by the client.';

COMMENT ON COLUMN public.client_wearable_connections.consented_at IS
  'Time the client explicitly accepted the connection-point health data notice.';

CREATE INDEX IF NOT EXISTS idx_client_wearable_events_received
  ON public.client_wearable_events(received_at);
