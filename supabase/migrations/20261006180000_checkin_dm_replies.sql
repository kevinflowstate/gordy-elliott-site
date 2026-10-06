-- A check-in reply is one private text DM, linked to the same client's check-in.
ALTER TABLE public.checkins ADD CONSTRAINT checkins_id_client_unique UNIQUE (id, client_id);
ALTER TABLE public.inbox_messages
  ADD COLUMN checkin_id uuid,
  ADD COLUMN checkin_context jsonb,
  ADD CONSTRAINT inbox_checkin_client_fk FOREIGN KEY (checkin_id, client_id)
    REFERENCES public.checkins(id, client_id) ON DELETE CASCADE,
  ADD CONSTRAINT inbox_checkin_reply_unique UNIQUE (checkin_id),
  ADD CONSTRAINT inbox_checkin_context_check CHECK (
    (checkin_id IS NULL AND checkin_context IS NULL) OR
    (checkin_id IS NOT NULL AND checkin_context IS NOT NULL
      AND jsonb_typeof(checkin_context) = 'object'
      AND sender_role = 'admin' AND message_type = 'text')
  );

ALTER TABLE public.checkins ADD COLUMN reply_message_id uuid REFERENCES public.inbox_messages(id) ON DELETE SET NULL;

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
    SELECT config INTO v_config FROM public.checkin_forms WHERE id = v_checkin.checkin_form_id;
    IF v_config IS NULL THEN
      SELECT config INTO v_config FROM public.checkin_forms WHERE is_default = true ORDER BY created_at LIMIT 1;
    END IF;
    IF v_config IS NULL THEN
      SELECT config INTO v_config FROM public.form_config WHERE form_type = 'checkin' LIMIT 1;
    END IF;
    v_context := jsonb_build_object(
      'submitted_at', v_checkin.created_at, 'mood', v_checkin.mood,
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
