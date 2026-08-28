-- SHIFT-only community thread. The application server owns all reads and
-- writes so membership checks, rate limits and signed media URLs stay in one
-- place. Direct authenticated table/storage access remains closed.

CREATE TABLE IF NOT EXISTS public.shift_community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'client')),
  message text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'audio', 'image', 'file')),
  media_bucket text,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds integer,
  media_width integer,
  media_height integer,
  media_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_community_message_content_check CHECK (
    (
      message_type = 'text'
      AND length(btrim(message)) BETWEEN 1 AND 4000
      AND media_path IS NULL
    )
    OR (
      message_type = 'audio'
      AND message = ''
      AND media_bucket = 'shift-community-media'
      AND media_path IS NOT NULL
      AND media_mime_type IN ('audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg')
      AND media_size_bytes BETWEEN 1 AND 15728640
      AND media_duration_seconds BETWEEN 1 AND 180
    )
    OR (
      message_type = 'image'
      AND message = ''
      AND media_bucket = 'shift-community-media'
      AND media_path IS NOT NULL
      AND media_mime_type IN ('image/jpeg', 'image/png')
      AND media_size_bytes BETWEEN 1 AND 10485760
      AND media_width BETWEEN 1 AND 12000
      AND media_height BETWEEN 1 AND 12000
    )
    OR (
      message_type = 'file'
      AND message = ''
      AND media_bucket = 'shift-community-media'
      AND media_path IS NOT NULL
      AND media_mime_type IN (
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      AND media_size_bytes BETWEEN 1 AND 10485760
      AND length(btrim(COALESCE(media_filename, ''))) BETWEEN 1 AND 180
    )
  )
);

CREATE INDEX IF NOT EXISTS shift_community_messages_created_at_idx
  ON public.shift_community_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS shift_community_messages_sender_idx
  ON public.shift_community_messages (sender_user_id, created_at DESC);

ALTER TABLE public.shift_community_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shift_community_messages FROM anon, authenticated;

COMMENT ON TABLE public.shift_community_messages IS
  'SHIFT-only group conversation. Access is enforced by server routes against active programme membership.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shift-community-media',
  'shift-community-media',
  false,
  15728640,
  ARRAY[
    'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/ogg',
    'image/jpeg', 'image/png',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No client storage policy is created. Uploads and short-lived download URLs
-- are produced only after the application server verifies SHIFT membership.
DROP POLICY IF EXISTS "Authenticated users can access SHIFT community media" ON storage.objects;
DROP POLICY IF EXISTS "SHIFT clients can access community media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can access SHIFT community media" ON storage.objects;
