-- Business-only programme; no existing client is migrated or invited by this change.
ALTER TABLE public.client_profiles DROP CONSTRAINT IF EXISTS client_profiles_programme_type_check;
ALTER TABLE public.client_profiles ADD CONSTRAINT client_profiles_programme_type_check CHECK (programme_type IN ('capacity','shift','in_person','boardroom'));
ALTER TABLE public.training_modules DROP CONSTRAINT IF EXISTS training_modules_programme_audiences_check;
ALTER TABLE public.training_modules ADD CONSTRAINT training_modules_programme_audiences_check CHECK (cardinality(programme_audiences)>0 AND programme_audiences <@ ARRAY['capacity','shift','in_person','boardroom']::text[]);
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS form_config_snapshot jsonb;
ALTER TABLE public.business_plans ADD COLUMN IF NOT EXISTS pdf_url text, ADD COLUMN IF NOT EXISTS title text, ADD COLUMN IF NOT EXISTS start_date date, ADD COLUMN IF NOT EXISTS duration_days integer;
ALTER TABLE public.business_plan_phases ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.business_plan_items ADD COLUMN IF NOT EXISTS due_date date, ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';

-- Keep plan writes atomic. Client lock also serializes creation of replacement plans.
CREATE OR REPLACE FUNCTION public.save_business_plan(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_id uuid := (payload->>'id')::uuid;
  v_client uuid := (payload->>'client_id')::uuid;
  v_phase jsonb; v_item jsonb; v_phase_id uuid; v_item_id uuid;
  v_existing boolean; v_phase_ids uuid[] := '{}'; v_item_ids uuid[] := '{}';
BEGIN
  IF payload->>'status' NOT IN ('active','completed') OR jsonb_typeof(payload->'phases') <> 'array' OR jsonb_array_length(payload->'phases') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  PERFORM id FROM public.client_profiles WHERE id=v_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.business_plans WHERE id=v_id) INTO v_existing;
  IF v_existing AND NOT EXISTS(SELECT 1 FROM public.business_plans WHERE id=v_id AND client_id=v_client) THEN RAISE EXCEPTION 'Plan belongs to another client'; END IF;
  IF v_existing AND payload->>'status'='active' AND EXISTS(SELECT 1 FROM public.business_plans WHERE id=v_id AND status<>'active') THEN RAISE EXCEPTION 'This plan block is no longer active; reload or create a new block'; END IF;
  FOR v_phase IN SELECT value FROM jsonb_array_elements(payload->'phases') LOOP
    v_phase_id := (v_phase->>'id')::uuid;
    IF v_phase_id = ANY(v_phase_ids) THEN RAISE EXCEPTION 'Duplicate phase'; END IF;
    v_phase_ids := array_append(v_phase_ids,v_phase_id);
    IF EXISTS(SELECT 1 FROM public.business_plan_phases WHERE id=v_phase_id AND plan_id<>v_id) THEN RAISE EXCEPTION 'Phase belongs to another plan'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_phase->'items') LOOP
      v_item_id := (v_item->>'id')::uuid;
      IF v_item_id=ANY(v_item_ids) THEN RAISE EXCEPTION 'Duplicate action'; END IF;
      v_item_ids:=array_append(v_item_ids,v_item_id);
      IF EXISTS(SELECT 1 FROM public.business_plan_items i JOIN public.business_plan_phases p ON p.id=i.phase_id WHERE i.id=v_item_id AND p.plan_id<>v_id) THEN RAISE EXCEPTION 'Action belongs to another plan'; END IF;
    END LOOP;
  END LOOP;
  -- Removing completed/noted actions would lose shared progress; use a new block instead.
  IF EXISTS(SELECT 1 FROM public.business_plan_items i JOIN public.business_plan_phases p ON p.id=i.phase_id WHERE p.plan_id=v_id AND NOT(i.id=ANY(v_item_ids)) AND (i.completed OR nullif(btrim(i.notes),'') IS NOT NULL)) THEN RAISE EXCEPTION 'Keep actions with progress or notes, or create a new plan block'; END IF;
  INSERT INTO public.business_plans(id,client_id,summary,status,title,start_date,duration_days,discovery_answers,pdf_url,completed_at)
    VALUES(v_id,v_client,payload->>'summary',payload->>'status',payload->>'title',nullif(payload->>'start_date','')::date,(payload->>'duration_days')::integer,payload->'discovery_answers',payload->>'pdf_url',CASE WHEN payload->>'status'='completed' THEN now() END)
    ON CONFLICT(id) DO UPDATE SET summary=EXCLUDED.summary,status=EXCLUDED.status,title=EXCLUDED.title,start_date=EXCLUDED.start_date,duration_days=EXCLUDED.duration_days,discovery_answers=EXCLUDED.discovery_answers,pdf_url=EXCLUDED.pdf_url,completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(business_plans.completed_at,now()) END;
  FOR v_phase IN SELECT value FROM jsonb_array_elements(payload->'phases') LOOP
    v_phase_id:=(v_phase->>'id')::uuid;
    INSERT INTO public.business_plan_phases(id,plan_id,name,notes,order_index,due_date) VALUES(v_phase_id,v_id,v_phase->>'name',COALESCE(v_phase->>'notes',''),(v_phase->>'order_index')::integer,nullif(v_phase->>'due_date','')::date)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,notes=EXCLUDED.notes,order_index=EXCLUDED.order_index,due_date=EXCLUDED.due_date;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_phase->'items') LOOP
      INSERT INTO public.business_plan_items(id,phase_id,title,category,due_date,notes,completed,completed_at,order_index)
        VALUES((v_item->>'id')::uuid,v_phase_id,v_item->>'title',COALESCE(v_item->>'category',''),nullif(v_item->>'due_date','')::date,COALESCE(v_item->>'notes',''),COALESCE((v_item->>'completed')::boolean,false),CASE WHEN (v_item->>'completed')::boolean THEN now() END,(v_item->>'order_index')::integer)
        ON CONFLICT(id) DO UPDATE SET phase_id=EXCLUDED.phase_id,title=EXCLUDED.title,category=EXCLUDED.category,due_date=EXCLUDED.due_date,order_index=EXCLUDED.order_index;
      -- Existing completion and client notes deliberately survive stale coach edits.
    END LOOP;
    DELETE FROM public.phase_training_links WHERE phase_id=v_phase_id;
    INSERT INTO public.phase_training_links(phase_id,content_id) SELECT v_phase_id,value::uuid FROM jsonb_array_elements_text(v_phase->'linked_trainings') ON CONFLICT DO NOTHING;
  END LOOP;
  DELETE FROM public.business_plan_items i USING public.business_plan_phases p WHERE p.id=i.phase_id AND p.plan_id=v_id AND NOT(i.id=ANY(v_item_ids));
  DELETE FROM public.business_plan_phases WHERE plan_id=v_id AND NOT(id=ANY(v_phase_ids));
  IF payload->>'status'='active' THEN UPDATE public.business_plans SET status='completed',completed_at=COALESCE(completed_at,now()) WHERE client_id=v_client AND id<>v_id AND status='active'; END IF;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_business_plan(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_business_plan(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_business_plan_item(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_item public.business_plan_items%ROWTYPE; v_client uuid; v_plan uuid; v_user uuid;
BEGIN
  SELECT p.id,p.client_id,cp.user_id INTO v_plan,v_client,v_user FROM public.business_plan_items i JOIN public.business_plan_phases ph ON ph.id=i.phase_id JOIN public.business_plans p ON p.id=ph.plan_id JOIN public.client_profiles cp ON cp.id=p.client_id WHERE i.id=(payload->>'item_id')::uuid AND p.status='active';
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Active action not found'; END IF;
  PERFORM id FROM public.client_profiles WHERE id=v_client FOR UPDATE;
  -- Check again after waiting for any concurrent replacement plan to finish.
  IF NOT EXISTS(SELECT 1 FROM public.business_plans WHERE id=v_plan AND status='active') THEN RAISE EXCEPTION 'Plan is no longer active'; END IF;
  IF payload ? 'user_id' THEN
    IF v_user IS DISTINCT FROM (payload->>'user_id')::uuid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  ELSIF payload ? 'client_id' THEN
    IF v_client IS DISTINCT FROM (payload->>'client_id')::uuid THEN RAISE EXCEPTION 'Wrong client'; END IF;
  ELSE RAISE EXCEPTION 'Action owner required'; END IF;
  SELECT * INTO v_item FROM public.business_plan_items WHERE id=(payload->>'item_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active action not found'; END IF;
  IF payload ? 'notes' AND (jsonb_typeof(payload->'notes')<>'string' OR length(payload->>'notes')>20000) THEN RAISE EXCEPTION 'Invalid notes'; END IF;
  IF payload ? 'completed' AND jsonb_typeof(payload->'completed')<>'boolean' THEN RAISE EXCEPTION 'Invalid completion'; END IF;
  UPDATE public.business_plan_items SET notes=CASE WHEN payload ? 'notes' THEN payload->>'notes' ELSE notes END,
    completed=CASE WHEN payload ? 'completed' THEN (payload->>'completed')::boolean WHEN NOT(payload ? 'notes') THEN NOT completed ELSE completed END,
    completed_at=CASE WHEN payload ? 'completed' THEN CASE WHEN (payload->>'completed')::boolean THEN COALESCE(completed_at,now()) END WHEN NOT(payload ? 'notes') THEN CASE WHEN NOT completed THEN now() END ELSE completed_at END
    WHERE id=v_item.id RETURNING * INTO v_item;
  RETURN to_jsonb(v_item);
END; $$;
REVOKE ALL ON FUNCTION public.update_business_plan_item(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_plan_item(jsonb) TO service_role;

-- Boardroom documents use the same client-owned storage restrictions.
DROP POLICY IF EXISTS "Eligible clients can read own documents" ON public.client_documents;
CREATE POLICY "Eligible clients can read own documents" ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

DROP POLICY IF EXISTS "Eligible clients can create own documents" ON public.client_documents;
CREATE POLICY "Eligible clients can create own documents" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id = client_documents.client_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

DROP POLICY IF EXISTS "Eligible clients can update own documents" ON public.client_documents;
CREATE POLICY "Eligible clients can update own documents" ON public.client_documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_documents.client_id
      AND cp.user_id = (SELECT auth.uid())
      AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_documents.client_id
      AND cp.user_id = (SELECT auth.uid())
      AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
  ));

DROP POLICY IF EXISTS "VIP clients can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "VIP clients can delete own documents" ON storage.objects;

DROP POLICY IF EXISTS "Eligible clients can upload own documents" ON storage.objects;
CREATE POLICY "Eligible clients can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

DROP POLICY IF EXISTS "Eligible clients can read own document objects" ON storage.objects;
CREATE POLICY "Eligible clients can read own document objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

DROP POLICY IF EXISTS "Eligible clients can update own document objects" ON storage.objects;
CREATE POLICY "Eligible clients can update own document objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

DROP POLICY IF EXISTS "Eligible clients can delete own document objects" ON storage.objects;
CREATE POLICY "Eligible clients can delete own document objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM public.client_profiles cp
      WHERE cp.id::text = (storage.foldername(name))[1]
        AND cp.user_id = (SELECT auth.uid())
        AND cp.programme_type IN ('capacity', 'in_person', 'boardroom')
    )
  );

-- Quote the submitted schema, preserving business metric wording after form edits.
CREATE OR REPLACE FUNCTION public.save_checkin_dm_reply(
  p_admin_id uuid, p_checkin_id uuid, p_reply text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_checkin public.checkins%ROWTYPE;
  v_message public.inbox_messages%ROWTYPE;
  v_context jsonb;
  v_created boolean;
  v_config jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reply IS NULL OR char_length(btrim(p_reply)) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Reply must be between 1 and 4000 characters' USING ERRCODE = '22023';
  END IF;
  -- Serializes retries/concurrent saves, and both writes roll back together.
  SELECT * INTO v_checkin FROM public.checkins WHERE id = p_checkin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_message FROM public.inbox_messages WHERE checkin_id = p_checkin_id;
  v_created := NOT FOUND;

  IF v_created THEN
    v_config := v_checkin.form_config_snapshot;
    IF v_config IS NULL THEN SELECT config INTO v_config FROM public.checkin_forms WHERE id = v_checkin.checkin_form_id; END IF;
    IF v_config IS NULL THEN
      SELECT config INTO v_config FROM public.checkin_forms WHERE is_default = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_config IS NULL THEN
      SELECT config INTO v_config FROM public.form_config WHERE form_type = 'checkin' LIMIT 1;
    END IF;
    v_context := jsonb_build_object(
      'submitted_at', v_checkin.created_at, 'mood', CASE WHEN v_config->>'mood_enabled' = 'false' THEN NULL ELSE v_checkin.mood END,
      'wins', v_checkin.wins, 'challenges', v_checkin.challenges,
      'questions', v_checkin.questions, 'responses', COALESCE(v_checkin.responses, '{}'::jsonb),
      'config', v_config
    );
    INSERT INTO public.inbox_messages
      (client_id, sender_user_id, sender_role, message, message_type,
       read_by_admin, read_by_client, checkin_id, checkin_context)
    VALUES (v_checkin.client_id, p_admin_id, 'admin', btrim(p_reply), 'text',
      true, false, p_checkin_id, v_context)
    RETURNING * INTO v_message;
  ELSIF v_message.message IS DISTINCT FROM btrim(p_reply) THEN
    -- Preserve the original quoted check-in and read state. An edit is not a new alert.
    UPDATE public.inbox_messages SET message = btrim(p_reply)
      WHERE id = v_message.id RETURNING * INTO v_message;
  END IF;

  UPDATE public.checkins SET admin_reply = v_message.message, reply_message_id = v_message.id,
    replied_at = CASE WHEN admin_reply IS DISTINCT FROM v_message.message OR replied_at IS NULL
      THEN now() ELSE replied_at END
    WHERE id = p_checkin_id;
  RETURN jsonb_build_object('message_id', v_message.id, 'client_id', v_checkin.client_id, 'created', v_created);
END;
$$;
REVOKE ALL ON FUNCTION public.save_checkin_dm_reply(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_checkin_dm_reply(uuid, uuid, text) TO service_role;
