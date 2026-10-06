-- Preserve the existing iPhone API/upsert contract while admitting FCM tokens.
ALTER TABLE public.native_push_devices
  DROP CONSTRAINT IF EXISTS native_push_devices_platform_check,
  DROP CONSTRAINT IF EXISTS native_push_devices_token_check;

ALTER TABLE public.native_push_devices
  ADD CONSTRAINT native_push_devices_platform_check CHECK (platform IN ('ios', 'android')),
  ADD CONSTRAINT native_push_devices_token_check CHECK (
    (platform = 'ios' AND char_length(token) BETWEEN 32 AND 256 AND token ~ '^[A-Fa-f0-9]+$')
    OR
    (platform = 'android' AND environment = 'production' AND char_length(token) BETWEEN 32 AND 4096
      AND token ~ '^[A-Za-z0-9_:\-]+$')
  );

COMMENT ON TABLE public.native_push_devices IS
  'Server-managed APNs and FCM device tokens, registered via authenticated API routes. RLS and service-role-only grants are unchanged.';
