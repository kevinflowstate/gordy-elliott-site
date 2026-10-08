-- Exercise identity cannot change even before its first log: a concurrent log must never attach to a replacement.
CREATE OR REPLACE FUNCTION public.save_client_exercise_plan(p_plan jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_plan_id uuid := nullif(p_plan->>'id','')::uuid;
  v_client_id uuid := (p_plan->>'client_id')::uuid;
  v_session_id uuid; v_item_id uuid; v_session jsonb; v_item jsonb;
  v_existing public.client_exercise_plans%ROWTYPE;
  v_sessions uuid[] := '{}'; v_items uuid[] := '{}';
BEGIN
  IF v_client_id IS NULL OR nullif(trim(p_plan->>'name'),'') IS NULL
     OR jsonb_typeof(p_plan->'sessions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid client training plan';
  END IF;
  -- Serialize new plans and edits for this client, including active-plan replacement.
  PERFORM id FROM public.client_profiles WHERE id=v_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.client_exercise_plans WHERE id=v_plan_id FOR UPDATE;
    IF NOT FOUND OR v_existing.client_id IS DISTINCT FROM v_client_id THEN
      RAISE EXCEPTION 'Training plan does not belong to this client';
    END IF;
    IF nullif(p_plan->>'expected_updated_at','') IS NOT NULL AND
       v_existing.updated_at IS DISTINCT FROM (p_plan->>'expected_updated_at')::timestamptz THEN
      RAISE EXCEPTION 'Reload this plan before saving: it was changed in another session.';
    END IF;
    UPDATE public.client_exercise_plans SET name=trim(p_plan->>'name'),
      description=nullif(p_plan->>'description',''), overview=nullif(trim(p_plan->>'overview'),''),
      status=coalesce(nullif(p_plan->>'status',''),v_existing.status),
      start_date=CASE WHEN p_plan ? 'start_date' THEN nullif(p_plan->>'start_date','')::date ELSE start_date END,
      end_date=CASE WHEN p_plan ? 'end_date' THEN nullif(p_plan->>'end_date','')::date ELSE end_date END,
      updated_at=now() WHERE id=v_plan_id;
  ELSE
    UPDATE public.client_exercise_plans SET status='archived',updated_at=now()
      WHERE client_id=v_client_id AND status='active';
    INSERT INTO public.client_exercise_plans(client_id,template_id,name,description,overview,status,start_date,end_date)
    VALUES(v_client_id,nullif(p_plan->>'template_id','')::uuid,trim(p_plan->>'name'),
      nullif(p_plan->>'description',''),nullif(trim(p_plan->>'overview'),''),
      coalesce(nullif(p_plan->>'status',''),'active'),
      coalesce(nullif(p_plan->>'start_date','')::date,current_date),nullif(p_plan->>'end_date','')::date)
    RETURNING id INTO v_plan_id;
  END IF;
  FOR v_session IN SELECT value FROM jsonb_array_elements(p_plan->'sessions') LOOP
    v_session_id := nullif(v_session->>'id','')::uuid;
    IF v_existing.id IS NOT NULL AND v_session_id IS NULL THEN
      RAISE EXCEPTION 'Reload this plan before saving: existing session identities are required.';
    END IF;
    v_session_id := coalesce(v_session_id,gen_random_uuid());
    IF v_session_id=ANY(v_sessions) OR EXISTS(SELECT 1 FROM public.client_exercise_sessions
        WHERE id=v_session_id AND plan_id<>v_plan_id) THEN
      RAISE EXCEPTION 'Invalid or duplicate training session identity';
    END IF;
    v_sessions := array_append(v_sessions,v_session_id);
    INSERT INTO public.client_exercise_sessions(id,plan_id,name,day_number,notes)
    VALUES(v_session_id,v_plan_id,trim(v_session->>'name'),(v_session->>'day_number')::int,nullif(v_session->>'notes',''))
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,day_number=EXCLUDED.day_number,notes=EXCLUDED.notes;
    IF jsonb_typeof(v_session->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid training items'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_session->'items') LOOP
      v_item_id := nullif(v_item->>'id','')::uuid;
      IF v_existing.id IS NOT NULL AND v_item_id IS NULL THEN
        RAISE EXCEPTION 'Reload this plan before saving: existing exercise identities are required.';
      END IF;
      v_item_id := coalesce(v_item_id,gen_random_uuid());
      IF v_item_id=ANY(v_items) OR EXISTS(SELECT 1 FROM public.client_exercise_session_items i
          JOIN public.client_exercise_sessions s ON s.id=i.session_id
          WHERE i.id=v_item_id AND s.plan_id<>v_plan_id) THEN
        RAISE EXCEPTION 'Invalid or duplicate training exercise identity';
      END IF;
      IF EXISTS(SELECT 1 FROM public.client_exercise_session_items i
          WHERE i.id=v_item_id AND (i.exercise_id IS DISTINCT FROM (v_item->>'exercise_id')::uuid
            OR i.session_id<>v_session_id)) THEN
        RAISE EXCEPTION 'Existing exercises cannot be swapped or moved this way. Add the replacement as a new exercise to retain history.';
      END IF;
      v_items := array_append(v_items,v_item_id);
      INSERT INTO public.client_exercise_session_items(id,session_id,exercise_id,order_index,sets,reps,
        prescription_type,prescription_text,rest_seconds,tempo,notes,section_label,superset_group)
      VALUES(v_item_id,v_session_id,(v_item->>'exercise_id')::uuid,(v_item->>'order_index')::int,
        (v_item->>'sets')::int,v_item->>'reps',coalesce(v_item->>'prescription_type','sets_reps'),
        nullif(v_item->>'prescription_text',''),nullif(v_item->>'rest_seconds','')::int,
        nullif(v_item->>'tempo',''),nullif(v_item->>'notes',''),nullif(v_item->>'section_label',''),nullif(v_item->>'superset_group',''))
      ON CONFLICT(id) DO UPDATE SET session_id=EXCLUDED.session_id,exercise_id=EXCLUDED.exercise_id,
        order_index=EXCLUDED.order_index,sets=EXCLUDED.sets,reps=EXCLUDED.reps,
        prescription_type=EXCLUDED.prescription_type,prescription_text=EXCLUDED.prescription_text,
        rest_seconds=EXCLUDED.rest_seconds,tempo=EXCLUDED.tempo,notes=EXCLUDED.notes,
        section_label=EXCLUDED.section_label,superset_group=EXCLUDED.superset_group;
    END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.client_exercise_session_items i
      JOIN public.client_exercise_sessions s ON s.id=i.session_id
      WHERE s.plan_id=v_plan_id AND NOT(i.id=ANY(v_items))
        AND EXISTS(SELECT 1 FROM public.client_exercise_logs l WHERE l.exercise_item_id=i.id)) THEN
    RAISE EXCEPTION 'Logged exercises cannot be removed. Archive this plan and create a new one to retain history.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.client_exercise_sessions s WHERE s.plan_id=v_plan_id AND NOT(s.id=ANY(v_sessions))
      AND (EXISTS(SELECT 1 FROM public.client_exercise_logs l WHERE l.session_id=s.id)
        OR EXISTS(SELECT 1 FROM public.client_exercise_session_summaries c WHERE c.session_id=s.id))) THEN
    RAISE EXCEPTION 'Logged sessions cannot be removed. Archive this plan and create a new one to retain history.';
  END IF;
  DELETE FROM public.client_exercise_session_items i USING public.client_exercise_sessions s
    WHERE i.session_id=s.id AND s.plan_id=v_plan_id AND NOT(i.id=ANY(v_items));
  DELETE FROM public.client_exercise_sessions WHERE plan_id=v_plan_id AND NOT(id=ANY(v_sessions));
  RETURN v_plan_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_client_exercise_plan(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_client_exercise_plan(jsonb) TO service_role;
