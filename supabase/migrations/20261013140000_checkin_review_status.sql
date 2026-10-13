ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.mark_checkin_reviewed(p_admin_id uuid, p_checkin_id uuid, p_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_checkin public.checkins%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_checkin FROM public.checkins WHERE id = p_checkin_id AND client_id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.checkins SET reviewed_at = COALESCE(reviewed_at, now()), reviewed_by = COALESCE(reviewed_by, p_admin_id)
    WHERE id = p_checkin_id RETURNING * INTO v_checkin;
  RETURN jsonb_build_object('reviewed_at', v_checkin.reviewed_at);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_checkin_reviewed(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_checkin_reviewed(uuid, uuid, uuid) TO service_role;

-- A new composer reply cannot silently overwrite a reply sent from another tab.
CREATE OR REPLACE FUNCTION public.send_checkin_dm_reply(p_admin_id uuid, p_checkin_id uuid, p_client_id uuid, p_reply text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_checkin public.checkins%ROWTYPE; v_saved jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_checkin FROM public.checkins WHERE id = p_checkin_id AND client_id = p_client_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in not found' USING ERRCODE = 'P0002'; END IF;
  IF NULLIF(btrim(v_checkin.admin_reply), '') IS NOT NULL AND v_checkin.admin_reply IS DISTINCT FROM btrim(p_reply) THEN
    RAISE EXCEPTION 'Check-in already has a reply. Continue in DMs.' USING ERRCODE = '40001';
  END IF;
  v_saved := public.save_checkin_dm_reply(p_admin_id, p_checkin_id, p_reply);
  IF (v_saved->>'created')::boolean AND jsonb_typeof(v_checkin.form_config_snapshot) = 'object' THEN
    UPDATE public.inbox_messages SET checkin_context = jsonb_set(checkin_context, '{config}', v_checkin.form_config_snapshot)
      WHERE id = (v_saved->>'message_id')::uuid;
  END IF;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.send_checkin_dm_reply(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_checkin_dm_reply(uuid, uuid, uuid, text) TO service_role;

-- Client-owned check-in edits must never forge coach review metadata.
CREATE OR REPLACE FUNCTION public.guard_checkin_review_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    IF (TG_OP = 'INSERT' AND (NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL))
      OR (TG_OP = 'UPDATE' AND (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by)) THEN
      RAISE EXCEPTION 'Coach review status cannot be changed by clients' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_checkin_review_status ON public.checkins;
CREATE TRIGGER guard_checkin_review_status BEFORE INSERT OR UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.guard_checkin_review_status();
