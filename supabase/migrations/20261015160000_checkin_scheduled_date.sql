ALTER TABLE public.checkins ADD COLUMN scheduled_date date;
CREATE UNIQUE INDEX checkins_client_scheduled_date_unique ON public.checkins(client_id,scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE FUNCTION public.guard_checkin_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_today date:=(now() AT TIME ZONE 'Europe/London')::date; v_start date; v_day text; v_target int; v_config jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN RAISE EXCEPTION 'Check-in dates and owner cannot change'; END IF;
  RETURN NEW;
 END IF;
 SELECT p.start_date,p.checkin_day,f.config INTO v_start,v_day,v_config FROM client_profiles p LEFT JOIN checkin_forms f ON f.id=p.checkin_form_id WHERE p.id=NEW.client_id FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Client not found'; END IF;
 IF v_config IS NULL THEN SELECT config INTO v_config FROM checkin_forms WHERE is_default ORDER BY created_at LIMIT 1; END IF;
 v_day:=lower(coalesce(nullif(v_day,''),v_config->>'checkin_day','monday'));
 v_target:=coalesce(array_position(ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],v_day)-1,1);
 -- Legacy callers get the latest due date; never invent an earlier submission timestamp.
 NEW.scheduled_date:=coalesce(NEW.scheduled_date,v_today-((extract(dow FROM v_today)::int-v_target+7)%7));
 IF NEW.scheduled_date>v_today OR NEW.scheduled_date<greatest(coalesce(v_start,v_today-364),v_today-364)
 OR extract(dow FROM NEW.scheduled_date)::int<>v_target THEN RAISE EXCEPTION 'Choose a valid past scheduled check-in date'; END IF;
 IF EXISTS(SELECT 1 FROM checkins c WHERE c.client_id=NEW.client_id AND c.scheduled_date IS NULL AND date_trunc('week',c.created_at AT TIME ZONE 'Europe/London')::date=date_trunc('week',NEW.scheduled_date)::date) THEN RAISE EXCEPTION 'This week already has a saved legacy check-in; reopen it'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_checkin_schedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER checkin_schedule_guard BEFORE INSERT OR UPDATE ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.guard_checkin_schedule();

CREATE OR REPLACE FUNCTION public.save_foundations_review(p_admin_id uuid,p_client_id uuid,p_start date,p_end date,p_response text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_message uuid; v_review uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin_id AND role='admin') OR NOT EXISTS(SELECT 1 FROM client_profiles WHERE id=p_client_id AND programme_type='foundations') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF length(trim(p_response)) NOT BETWEEN 1 AND 4000 OR p_end<=p_start THEN RAISE EXCEPTION 'Invalid review'; END IF;
 INSERT INTO inbox_messages(client_id,sender_user_id,sender_role,message,read_by_admin,read_by_client) VALUES(p_client_id,p_admin_id,'admin',trim(p_response),true,false) RETURNING id INTO v_message;
 INSERT INTO foundations_monthly_reviews(client_id,period_start,period_end,response,message_id,reviewed_by) VALUES(p_client_id,p_start,p_end,trim(p_response),v_message,p_admin_id) RETURNING id INTO v_review;
 -- Include still-unreviewed late reflections from earlier periods in this monthly response.
 UPDATE checkins SET reviewed_at=now(),reviewed_by=p_admin_id WHERE client_id=p_client_id AND reviewed_at IS NULL
 AND ((scheduled_date IS NOT NULL AND scheduled_date<p_end) OR (scheduled_date IS NULL AND (created_at AT TIME ZONE 'Europe/London')::date>=p_start AND (created_at AT TIME ZONE 'Europe/London')::date<p_end));
 RETURN v_review;
END $$;
