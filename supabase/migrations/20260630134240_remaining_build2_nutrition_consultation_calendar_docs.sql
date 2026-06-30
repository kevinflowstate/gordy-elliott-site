-- Remaining Build 2 support:
-- - richer nutrition data (sugar/fibre targets and client logs)
-- - consultation AI extraction/profile setup fields
-- - private VIP client document vault metadata + storage policies

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS sugar_g numeric(6,1) NOT NULL DEFAULT 0;

ALTER TABLE public.nutrition_templates
  ADD COLUMN IF NOT EXISTS target_fibre_g numeric(6,1),
  ADD COLUMN IF NOT EXISTS target_sugar_g numeric(6,1);

ALTER TABLE public.client_nutrition_plans
  ADD COLUMN IF NOT EXISTS target_fibre_g numeric(6,1),
  ADD COLUMN IF NOT EXISTS target_sugar_g numeric(6,1);

ALTER TABLE public.client_quick_meals
  ADD COLUMN IF NOT EXISTS fibre_g numeric(6,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar_g numeric(6,1) NOT NULL DEFAULT 0;

ALTER TABLE public.client_saved_meals
  ADD COLUMN IF NOT EXISTS fibre_g numeric(6,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar_g numeric(6,1) NOT NULL DEFAULT 0;

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS consultation_summary jsonb,
  ADD COLUMN IF NOT EXISTS profile_setup_data jsonb,
  ADD COLUMN IF NOT EXISTS profile_setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS wearables_preference text,
  ADD COLUMN IF NOT EXISTS wearables_notes text;

CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'bloodwork',
  storage_bucket text NOT NULL DEFAULT 'client-documents',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_documents_category_check
    CHECK (category IN ('bloodwork', 'scan', 'medical', 'progress', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_created
  ON public.client_documents(client_id, created_at DESC)
  WHERE is_active = true;

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own vip documents" ON public.client_documents;
CREATE POLICY "Clients can read own vip documents" ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "Clients can create own vip documents" ON public.client_documents;
CREATE POLICY "Clients can create own vip documents" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "Clients can update own vip documents" ON public.client_documents;
CREATE POLICY "Clients can update own vip documents" ON public.client_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "Admins can manage client documents" ON public.client_documents;
CREATE POLICY "Admins can manage client documents" ON public.client_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "VIP clients can upload own documents" ON storage.objects;
CREATE POLICY "VIP clients can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "VIP clients can read own documents" ON storage.objects;
CREATE POLICY "VIP clients can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "VIP clients can update own documents" ON storage.objects;
CREATE POLICY "VIP clients can update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "VIP clients can delete own documents" ON storage.objects;
CREATE POLICY "VIP clients can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1
      FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.tier = 'vip'
    )
  );

DROP POLICY IF EXISTS "Admins can manage client document objects" ON storage.objects;
CREATE POLICY "Admins can manage client document objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
