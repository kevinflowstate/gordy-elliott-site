-- Private DM photos. Objects remain private and are exposed only through
-- short-lived signed URLs after the application verifies thread access.

ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS image_bucket text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_mime_type text,
  ADD COLUMN IF NOT EXISTS image_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer;

ALTER TABLE public.inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_message_type_check;
ALTER TABLE public.inbox_messages
  ADD CONSTRAINT inbox_messages_message_type_check
  CHECK (message_type IN ('text', 'audio', 'image'));

ALTER TABLE public.inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_content_check;
ALTER TABLE public.inbox_messages
  ADD CONSTRAINT inbox_messages_content_check
  CHECK (
    (
      message_type = 'text'
      AND length(btrim(COALESCE(message, ''))) BETWEEN 1 AND 4000
      AND audio_path IS NULL
      AND image_path IS NULL
    )
    OR
    (
      message_type = 'audio'
      AND audio_bucket = 'inbox-audio'
      AND audio_path IS NOT NULL
      AND audio_mime_type IN ('audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg')
      AND audio_size_bytes BETWEEN 1 AND 15728640
      AND audio_duration_seconds BETWEEN 1 AND 180
      AND image_path IS NULL
    )
    OR
    (
      message_type = 'image'
      AND image_bucket = 'inbox-images'
      AND image_path IS NOT NULL
      AND image_mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND image_size_bytes BETWEEN 1 AND 10485760
      AND image_width BETWEEN 1 AND 12000
      AND image_height BETWEEN 1 AND 12000
      AND audio_path IS NULL
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox-images',
  'inbox-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The service-role application route owns upload and signed-link creation.
-- Direct authenticated access stays closed so clients cannot select another
-- client's object path or create orphan files outside a DM.
DROP POLICY IF EXISTS "Clients can upload own inbox images" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read own inbox images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage inbox images" ON storage.objects;
CREATE POLICY "Admins can manage inbox images" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'inbox-images'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'inbox-images'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
