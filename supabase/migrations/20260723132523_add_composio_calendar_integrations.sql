CREATE TABLE IF NOT EXISTS public.client_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'outlook')),
  composio_user_id TEXT NOT NULL,
  composio_connected_account_id TEXT,
  composio_auth_config_id TEXT,
  status TEXT NOT NULL DEFAULT 'connecting'
    CHECK (status IN ('connecting', 'connected', 'needs_reauth', 'disconnected', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_calendar_connections_composio_account
  ON public.client_calendar_connections(composio_connected_account_id)
  WHERE composio_connected_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_calendar_connections_client_status
  ON public.client_calendar_connections(client_id, status);

CREATE TABLE IF NOT EXISTS public.client_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.client_calendar_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'outlook')),
  external_event_id TEXT NOT NULL,
  external_event_key TEXT NOT NULL,
  calendar_id TEXT,
  title TEXT NOT NULL DEFAULT 'Busy',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  event_date_key DATE NOT NULL,
  event_time TEXT NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  busy_status TEXT,
  meeting_url TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, external_event_key)
);

CREATE INDEX IF NOT EXISTS idx_client_calendar_events_client_date
  ON public.client_calendar_events(client_id, event_date_key, starts_at);

CREATE INDEX IF NOT EXISTS idx_client_calendar_events_connection_sync
  ON public.client_calendar_events(connection_id, synced_at DESC);

ALTER TABLE public.client_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view allowed calendar connections" ON public.client_calendar_connections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_calendar_connections.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
    OR (SELECT private.is_admin())
  );

CREATE POLICY "Admins can insert calendar connections" ON public.client_calendar_connections
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins can update calendar connections" ON public.client_calendar_connections
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins can delete calendar connections" ON public.client_calendar_connections
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

CREATE POLICY "Authenticated users can view allowed synced calendar events" ON public.client_calendar_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE client_profiles.id = client_calendar_events.client_id
        AND client_profiles.user_id = (SELECT auth.uid())
    )
    OR (SELECT private.is_admin())
  );

CREATE POLICY "Admins can insert synced calendar events" ON public.client_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins can update synced calendar events" ON public.client_calendar_events
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins can delete synced calendar events" ON public.client_calendar_events
  FOR DELETE TO authenticated
  USING ((SELECT private.is_admin()));

GRANT SELECT ON public.client_calendar_connections TO authenticated;
GRANT SELECT ON public.client_calendar_events TO authenticated;
