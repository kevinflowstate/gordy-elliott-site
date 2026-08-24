-- Private DM voice notes. Audio objects are never public; the app returns short-lived signed URLs.

ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_bucket text,
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_mime_type text,
  ADD COLUMN IF NOT EXISTS audio_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds integer;

ALTER TABLE public.inbox_messages
  ALTER COLUMN message DROP NOT NULL,
  ALTER COLUMN message SET DEFAULT '';

ALTER TABLE public.inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_message_type_check;
ALTER TABLE public.inbox_messages
  ADD CONSTRAINT inbox_messages_message_type_check
  CHECK (message_type IN ('text', 'audio'));

ALTER TABLE public.inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_content_check;
ALTER TABLE public.inbox_messages
  ADD CONSTRAINT inbox_messages_content_check
  CHECK (
    (message_type = 'text' AND length(btrim(COALESCE(message, ''))) BETWEEN 1 AND 4000 AND audio_path IS NULL)
    OR
    (message_type = 'audio' AND audio_bucket = 'inbox-audio' AND audio_path IS NOT NULL
      AND audio_size_bytes BETWEEN 1 AND 15728640
      AND audio_duration_seconds BETWEEN 1 AND 180)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox-audio',
  'inbox-audio',
  false,
  15728640,
  ARRAY['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Clients can upload own inbox audio" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read own inbox audio" ON storage.objects;

-- Clients use the authenticated application route for uploads and short-lived
-- playback links. Keeping direct storage access closed prevents orphan uploads
-- and keeps thread authorization in one place.

DROP POLICY IF EXISTS "Admins can manage inbox audio" ON storage.objects;
CREATE POLICY "Admins can manage inbox audio" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'inbox-audio'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'inbox-audio'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
