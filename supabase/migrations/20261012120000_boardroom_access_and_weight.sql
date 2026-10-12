-- Additive preferences: no existing client is moved, enabled, invited or re-weighed.
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS fitness_plans_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb'));

-- Audience checks also apply to direct authenticated database reads, not just navigation.
DROP POLICY IF EXISTS "Programme audience restricts module reads" ON public.training_modules;
CREATE POLICY "Programme audience restricts module reads" ON public.training_modules AS RESTRICTIVE FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') OR
  (is_published AND EXISTS(SELECT 1 FROM public.client_profiles cp WHERE cp.user_id=auth.uid() AND cp.programme_type=ANY(programme_audiences)))
);
DROP POLICY IF EXISTS "Programme audience restricts lesson reads" ON public.module_content;
CREATE POLICY "Programme audience restricts lesson reads" ON public.module_content AS RESTRICTIVE FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') OR
  EXISTS(SELECT 1 FROM public.training_modules m WHERE m.id=module_id AND m.is_published AND EXISTS(SELECT 1 FROM public.client_profiles cp WHERE cp.user_id=auth.uid() AND cp.programme_type=ANY(m.programme_audiences)))
);
DROP POLICY IF EXISTS "Programme audience restricts progress" ON public.content_progress;
CREATE POLICY "Programme audience restricts progress" ON public.content_progress AS RESTRICTIVE FOR ALL TO authenticated USING (
  EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') OR
  EXISTS(SELECT 1 FROM public.client_profiles cp JOIN public.module_content c ON c.id=content_id JOIN public.training_modules m ON m.id=c.module_id WHERE cp.id=client_id AND cp.user_id=auth.uid() AND m.is_published AND cp.programme_type=ANY(m.programme_audiences))
) WITH CHECK (
  EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') OR
  EXISTS(SELECT 1 FROM public.client_profiles cp JOIN public.module_content c ON c.id=content_id JOIN public.training_modules m ON m.id=c.module_id WHERE cp.id=client_id AND cp.user_id=auth.uid() AND m.is_published AND cp.programme_type=ANY(m.programme_audiences))
);

CREATE TABLE IF NOT EXISTS public.lesson_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.module_content(id) ON DELETE CASCADE,
  reply_text text,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(COALESCE(reply_text,''))<=10000),
  CHECK (NULLIF(btrim(reply_text),'') IS NOT NULL OR audio_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lesson_responses_client_content ON public.lesson_responses(client_id,content_id,created_at DESC);
ALTER TABLE public.lesson_responses ENABLE ROW LEVEL SECURITY;
-- The server checks current module audience and signs audio URLs after authenticating each request.
REVOKE ALL ON public.lesson_responses FROM anon,authenticated;
GRANT ALL ON public.lesson_responses TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('lesson-responses','lesson-responses',false,3145728,ARRAY['audio/mp4','audio/x-m4a','audio/mpeg','audio/aac','audio/webm','audio/ogg'])
ON CONFLICT(id) DO NOTHING;
