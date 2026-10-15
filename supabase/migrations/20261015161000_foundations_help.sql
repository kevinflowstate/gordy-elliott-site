CREATE TABLE public.foundations_help_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
 submission_key uuid NOT NULL,client_name text NOT NULL,client_email text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('App or account problem','Getting unstuck')),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),notification_sent_at timestamptz,notification_email_id text,
 UNIQUE(client_id,submission_key)
);
ALTER TABLE public.foundations_help_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.foundations_help_requests FROM anon,authenticated;
GRANT ALL ON public.foundations_help_requests TO service_role;
CREATE FUNCTION public.submit_foundations_help(p_user_id uuid,p_key uuid,p_kind text,p_message text,p_test boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_client uuid;v_name text;v_email text;v_id uuid;
BEGIN
 SELECT p.id,u.full_name,u.email INTO v_client,v_name,v_email FROM client_profiles p JOIN users u ON u.id=p.user_id
 WHERE p.user_id=p_user_id AND p.programme_type='foundations' FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Foundations access required'; END IF;
 SELECT id INTO v_id FROM foundations_help_requests WHERE client_id=v_client AND submission_key=p_key;
 IF FOUND THEN RETURN v_id; END IF;
 IF (SELECT count(*) FROM foundations_help_requests WHERE client_id=v_client AND created_at>now()-interval '1 hour')>=3 THEN RAISE EXCEPTION 'HELP_RATE_LIMIT'; END IF;
 INSERT INTO foundations_help_requests(client_id,submission_key,client_name,client_email,kind,message,notification_sent_at,notification_email_id)
 VALUES(v_client,p_key,coalesce(v_name,'Client'),v_email,p_kind,trim(p_message),CASE WHEN p_test THEN now() END,CASE WHEN p_test THEN 'qa-fixture:no-email' END) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_foundations_help(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_foundations_help(uuid,uuid,text,text,boolean) TO service_role;
