BEGIN;
ALTER TABLE public.client_profiles DROP CONSTRAINT IF EXISTS client_profiles_programme_type_check;
ALTER TABLE public.client_profiles ADD CONSTRAINT client_profiles_programme_type_check CHECK (programme_type IN ('capacity','shift','in_person','boardroom','foundations'));
ALTER TABLE public.training_modules DROP CONSTRAINT IF EXISTS training_modules_programme_audiences_check;
ALTER TABLE public.training_modules ADD CONSTRAINT training_modules_programme_audiences_check CHECK (cardinality(programme_audiences)>0 AND programme_audiences <@ ARRAY['capacity','shift','in_person','boardroom','foundations']::text[]);

CREATE TABLE public.client_ai_daily_usage (
 client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
 usage_day date NOT NULL,
 reservation_id uuid NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 answered boolean NOT NULL DEFAULT false,
 PRIMARY KEY(client_id,usage_day)
);
ALTER TABLE public.client_ai_daily_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_ai_daily_usage TO service_role;
GRANT SELECT ON public.client_ai_daily_usage TO authenticated;
CREATE POLICY "Own daily allowance" ON public.client_ai_daily_usage FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.client_profiles cp WHERE cp.id=client_id AND cp.user_id=auth.uid()));
CREATE FUNCTION public.claim_foundations_ai(p_client_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_day date := (now() AT TIME ZONE 'Europe/London')::date; v_token uuid := gen_random_uuid(); v_saved uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM client_profiles WHERE id=p_client_id AND programme_type='foundations') THEN RAISE EXCEPTION 'Not a Foundations client'; END IF;
 INSERT INTO client_ai_daily_usage(client_id,usage_day,reservation_id) VALUES(p_client_id,v_day,v_token)
 ON CONFLICT(client_id,usage_day) DO UPDATE SET reservation_id=excluded.reservation_id,reserved_at=now()
 WHERE NOT client_ai_daily_usage.answered AND client_ai_daily_usage.reserved_at < now()-interval '5 minutes'
 RETURNING reservation_id INTO v_saved;
 RETURN jsonb_build_object('claimed',v_saved IS NOT NULL,'day',v_day,'token',v_saved);
END $$;
CREATE FUNCTION public.finish_foundations_ai(p_client_id uuid,p_day date,p_token uuid,p_success boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
 IF p_success THEN
  UPDATE client_ai_daily_usage SET answered=true WHERE client_id=p_client_id AND usage_day=p_day AND reservation_id=p_token AND NOT answered;
 ELSE
  DELETE FROM client_ai_daily_usage WHERE client_id=p_client_id AND usage_day=p_day AND reservation_id=p_token AND NOT answered;
 END IF;
 GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count=1;
END $$;
REVOKE ALL ON FUNCTION public.claim_foundations_ai(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_foundations_ai(uuid,date,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_foundations_ai(uuid),public.finish_foundations_ai(uuid,date,uuid,boolean) TO service_role;

-- Enforce one-way human messaging even through a direct authenticated database call.
CREATE FUNCTION public.guard_foundations_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.sender_role='client' AND EXISTS(SELECT 1 FROM client_profiles WHERE id=NEW.client_id AND programme_type='foundations') THEN RAISE EXCEPTION 'Foundations DMs are coach announcements only'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_foundations_dm() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER foundations_dm_guard BEFORE INSERT OR UPDATE OF client_id,sender_role ON public.inbox_messages FOR EACH ROW EXECUTE FUNCTION public.guard_foundations_dm();

CREATE TABLE public.foundations_monthly_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
 period_start date NOT NULL,
 period_end date NOT NULL CHECK(period_end>period_start),
 response text NOT NULL CHECK(length(trim(response)) BETWEEN 1 AND 4000),
 message_id uuid REFERENCES public.inbox_messages(id) ON DELETE SET NULL,
 reviewed_by uuid NOT NULL REFERENCES public.users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(client_id,period_start)
);
ALTER TABLE public.foundations_monthly_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.foundations_monthly_reviews TO service_role;
GRANT SELECT ON public.foundations_monthly_reviews TO authenticated;
CREATE POLICY "Own monthly reviews" ON public.foundations_monthly_reviews FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.client_profiles cp WHERE cp.id=client_id AND cp.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));
CREATE FUNCTION public.save_foundations_review(p_admin_id uuid,p_client_id uuid,p_start date,p_end date,p_response text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_message uuid; v_review uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin_id AND role='admin') OR NOT EXISTS(SELECT 1 FROM client_profiles WHERE id=p_client_id AND programme_type='foundations') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF length(trim(p_response)) NOT BETWEEN 1 AND 4000 OR p_end<=p_start THEN RAISE EXCEPTION 'Invalid review'; END IF;
 INSERT INTO inbox_messages(client_id,sender_user_id,sender_role,message,read_by_admin,read_by_client) VALUES(p_client_id,p_admin_id,'admin',trim(p_response),true,false) RETURNING id INTO v_message;
 INSERT INTO foundations_monthly_reviews(client_id,period_start,period_end,response,message_id,reviewed_by) VALUES(p_client_id,p_start,p_end,trim(p_response),v_message,p_admin_id) RETURNING id INTO v_review;
 RETURN v_review;
END $$;
REVOKE ALL ON FUNCTION public.save_foundations_review(uuid,uuid,date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_foundations_review(uuid,uuid,date,date,text) TO service_role;
COMMIT;
