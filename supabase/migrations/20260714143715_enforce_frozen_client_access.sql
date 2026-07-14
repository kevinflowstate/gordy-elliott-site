CREATE OR REPLACE FUNCTION private.client_access_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN account.role = 'admin' THEN true
      WHEN profile.lifecycle_status = 'access_frozen'
        AND (profile.lifecycle_resumes_at IS NULL OR profile.lifecycle_resumes_at > NOW())
        THEN false
      ELSE true
    END
    FROM public.users AS account
    LEFT JOIN public.client_profiles AS profile ON profile.user_id = account.id
    WHERE account.id = (SELECT auth.uid())
  ), false);
$$;

REVOKE ALL ON FUNCTION private.client_access_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.client_access_allowed() TO authenticated;

DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT table_class.relname AS table_name
    FROM pg_class AS table_class
    JOIN pg_namespace AS table_schema ON table_schema.oid = table_class.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_class.relkind IN ('r', 'p')
      AND table_class.relrowsecurity = true
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Frozen clients have no direct access" ON public.%I',
      target.table_name
    );
    EXECUTE format(
      'CREATE POLICY "Frozen clients have no direct access" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.client_access_allowed())) WITH CHECK ((SELECT private.client_access_allowed()))',
      target.table_name
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Frozen clients have no direct object access" ON storage.objects;
CREATE POLICY "Frozen clients have no direct object access"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT private.client_access_allowed()))
  WITH CHECK ((SELECT private.client_access_allowed()));
