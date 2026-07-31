ALTER TABLE public.native_push_devices
  DROP CONSTRAINT IF EXISTS native_push_devices_token_check;

ALTER TABLE public.native_push_devices
  ADD CONSTRAINT native_push_devices_token_check
  CHECK (char_length(token) BETWEEN 32 AND 256 AND token ~ '^[A-Fa-f0-9]+$');
