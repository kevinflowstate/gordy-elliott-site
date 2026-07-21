CREATE TABLE IF NOT EXISTS public.native_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  token text NOT NULL CHECK (char_length(token) BETWEEN 32 AND 256 AND token ~ '^[A-Fa-f0-9]+$'),
  app_id text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_failure text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token, app_id, environment)
);

CREATE INDEX IF NOT EXISTS native_push_devices_user_active_idx
  ON public.native_push_devices (user_id, app_id, environment)
  WHERE disabled_at IS NULL;

ALTER TABLE public.native_push_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.native_push_devices FROM anon, authenticated;
GRANT ALL ON TABLE public.native_push_devices TO service_role;

COMMENT ON TABLE public.native_push_devices IS
  'Server-managed APNs device tokens. Clients register through authenticated API routes and cannot query tokens directly.';
