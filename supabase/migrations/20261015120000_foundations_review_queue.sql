BEGIN;
CREATE OR REPLACE FUNCTION public.save_foundations_review(p_admin_id uuid,p_client_id uuid,p_start date,p_end date,p_response text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_message uuid; v_review uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin_id AND role='admin') OR NOT EXISTS(SELECT 1 FROM client_profiles WHERE id=p_client_id AND programme_type='foundations') THEN RAISE EXCEPTION 'Not authorised'; END IF;
 IF length(trim(p_response)) NOT BETWEEN 1 AND 4000 OR p_end<=p_start THEN RAISE EXCEPTION 'Invalid review'; END IF;
 INSERT INTO inbox_messages(client_id,sender_user_id,sender_role,message,read_by_admin,read_by_client) VALUES(p_client_id,p_admin_id,'admin',trim(p_response),true,false) RETURNING id INTO v_message;
 INSERT INTO foundations_monthly_reviews(client_id,period_start,period_end,response,message_id,reviewed_by) VALUES(p_client_id,p_start,p_end,trim(p_response),v_message,p_admin_id) RETURNING id INTO v_review;
 -- A monthly response covers these weekly reflections; retain their original answers and any replies.
 UPDATE public.checkins SET reviewed_at=now(),reviewed_by=p_admin_id
 WHERE client_id=p_client_id AND reviewed_at IS NULL
 AND created_at >= (p_start::timestamp AT TIME ZONE 'Europe/London')
 AND created_at < (p_end::timestamp AT TIME ZONE 'Europe/London');
 RETURN v_review;
END $$;
-- Bring already-sent monthly reviews into the same queue state without sending any messages.
UPDATE public.checkins c SET reviewed_at=r.reviewed_at,reviewed_by=r.reviewed_by
FROM public.foundations_monthly_reviews r
WHERE c.client_id=r.client_id AND c.reviewed_at IS NULL
AND c.created_at >= (r.period_start::timestamp AT TIME ZONE 'Europe/London')
AND c.created_at < (r.period_end::timestamp AT TIME ZONE 'Europe/London');
COMMIT;
