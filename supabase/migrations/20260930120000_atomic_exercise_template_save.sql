-- Replace a training template and its nested sessions in one transaction.
-- Invoked only by the server's service-role client after admin authorization.
CREATE OR REPLACE FUNCTION public.save_exercise_training_template(
  p_template_id uuid,
  p_template jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_template_id uuid;
  v_session_id uuid;
  v_session jsonb;
  v_item jsonb;
BEGIN
  IF p_template IS NULL OR nullif(trim(p_template->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Training template name is required';
  END IF;
  IF jsonb_typeof(p_template->'sessions') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Training template sessions must be an array';
  END IF;

  IF p_template_id IS NULL THEN
    INSERT INTO public.exercise_training_templates
      (name, description, overview, tags, category, is_active, updated_at)
    VALUES
      (trim(p_template->>'name'), nullif(trim(p_template->>'description'), ''),
       nullif(trim(p_template->>'overview'), ''),
       ARRAY(SELECT jsonb_array_elements_text(coalesce(p_template->'tags', '[]'::jsonb))),
       coalesce(nullif(p_template->>'category', ''), 'general'), true, now())
    RETURNING id INTO v_template_id;
  ELSE
    -- The row lock serializes two admins saving the same template concurrently.
    SELECT id INTO v_template_id
      FROM public.exercise_training_templates
      WHERE id = p_template_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Training template % no longer exists', p_template_id;
    END IF;
    UPDATE public.exercise_training_templates SET
      name = trim(p_template->>'name'),
      description = nullif(trim(p_template->>'description'), ''),
      overview = nullif(trim(p_template->>'overview'), ''),
      tags = ARRAY(SELECT jsonb_array_elements_text(coalesce(p_template->'tags', '[]'::jsonb))),
      category = coalesce(nullif(p_template->>'category', ''), 'general'),
      is_active = true,
      updated_at = now()
      WHERE id = v_template_id;
    DELETE FROM public.exercise_training_sessions WHERE template_id = v_template_id;
  END IF;

  FOR v_session IN SELECT value FROM jsonb_array_elements(p_template->'sessions') LOOP
    INSERT INTO public.exercise_training_sessions (template_id, name, day_number, notes)
    VALUES (
      v_template_id,
      trim(v_session->>'name'),
      (v_session->>'day_number')::integer,
      nullif(v_session->>'notes', '')
    ) RETURNING id INTO v_session_id;

    IF jsonb_typeof(v_session->'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Training session items must be an array';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_session->'items') LOOP
      INSERT INTO public.exercise_training_session_items
        (session_id, exercise_id, order_index, sets, reps, prescription_type,
         prescription_text, rest_seconds, tempo, notes, section_label, superset_group)
      VALUES (
        v_session_id,
        (v_item->>'exercise_id')::uuid,
        (v_item->>'order_index')::integer,
        (v_item->>'sets')::integer,
        v_item->>'reps',
        coalesce(v_item->>'prescription_type', 'sets_reps'),
        nullif(v_item->>'prescription_text', ''),
        nullif(v_item->>'rest_seconds', '')::integer,
        nullif(v_item->>'tempo', ''),
        nullif(v_item->>'notes', ''),
        nullif(v_item->>'section_label', ''),
        nullif(v_item->>'superset_group', '')
      );
    END LOOP;
  END LOOP;

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_exercise_training_template(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_exercise_training_template(uuid, jsonb)
  TO service_role;
