ALTER TABLE public.client_wearable_connections
 ADD COLUMN IF NOT EXISTS failure_reason TEXT NULL CHECK (failure_reason IS NULL OR failure_reason IN ('attempt_expired','widget_return_failed','provider_auth_error','provider_deauth','provider_revoked','provider_paused','orphan_reference')),
 ADD COLUMN IF NOT EXISTS last_data_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.client_wearable_connections.last_data_at IS 'Last webhook that contained at least one reading. last_sync_at remains the last accepted data webhook of any kind.';
