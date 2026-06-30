ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE TABLE IF NOT EXISTS public.client_key_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  date date NOT NULL,
  recurring boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tag text;

CREATE INDEX IF NOT EXISTS idx_client_key_dates_client_id ON public.client_key_dates(client_id);
CREATE INDEX IF NOT EXISTS idx_client_key_dates_date ON public.client_key_dates(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_tag
  ON public.notifications(user_id, tag)
  WHERE tag IS NOT NULL;

ALTER TABLE public.client_key_dates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_key_dates TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_key_dates' AND policyname = 'Clients can view own key dates'
  ) THEN
    CREATE POLICY "Clients can view own key dates" ON public.client_key_dates
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.client_profiles
          WHERE client_profiles.id = client_key_dates.client_id
            AND client_profiles.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_key_dates' AND policyname = 'Clients can insert own key dates'
  ) THEN
    CREATE POLICY "Clients can insert own key dates" ON public.client_key_dates
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.client_profiles
          WHERE client_profiles.id = client_key_dates.client_id
            AND client_profiles.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_key_dates' AND policyname = 'Clients can update own key dates'
  ) THEN
    CREATE POLICY "Clients can update own key dates" ON public.client_key_dates
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.client_profiles
          WHERE client_profiles.id = client_key_dates.client_id
            AND client_profiles.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.client_profiles
          WHERE client_profiles.id = client_key_dates.client_id
            AND client_profiles.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_key_dates' AND policyname = 'Clients can delete own key dates'
  ) THEN
    CREATE POLICY "Clients can delete own key dates" ON public.client_key_dates
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.client_profiles
          WHERE client_profiles.id = client_key_dates.client_id
            AND client_profiles.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_key_dates' AND policyname = 'Admins can manage all key dates'
  ) THEN
    CREATE POLICY "Admins can manage all key dates" ON public.client_key_dates
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;;
