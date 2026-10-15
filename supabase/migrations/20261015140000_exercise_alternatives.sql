-- Substitutions are per workout log. Assigned items and old logs retain their identity.
CREATE TABLE public.exercise_swap_profiles (
 exercise_id uuid PRIMARY KEY REFERENCES public.exercises(id), metadata jsonb,
 review_reason text NOT NULL DEFAULT 'Movement, purpose or variation needs coach review',
 rule_version text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exercise_alternatives (
 source_exercise_id uuid NOT NULL REFERENCES public.exercises(id),
 alternative_exercise_id uuid NOT NULL REFERENCES public.exercises(id),
 status text NOT NULL CHECK(status IN ('generated','approved','disabled')),
 source_evidence jsonb NOT NULL, target_evidence jsonb NOT NULL,
 rationale text NOT NULL, required_equipment text[] NOT NULL DEFAULT '{}',
 rule_version text NOT NULL, reviewed_by uuid REFERENCES public.users(id), reviewed_at timestamptz,
 PRIMARY KEY(source_exercise_id,alternative_exercise_id), CHECK(source_exercise_id<>alternative_exercise_id)
);
ALTER TABLE public.exercise_swap_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_alternatives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_swap_profiles,public.exercise_alternatives FROM anon,authenticated;
GRANT ALL ON public.exercise_swap_profiles,public.exercise_alternatives TO service_role;
ALTER TABLE public.client_exercise_logs
 ADD COLUMN performed_exercise_id uuid REFERENCES public.exercises(id),
 ADD COLUMN prescribed_exercise_id uuid REFERENCES public.exercises(id),
 ADD COLUMN performed_exercise_name text,
 ADD COLUMN prescribed_exercise_name text;
UPDATE public.client_exercise_logs l SET performed_exercise_id=i.exercise_id,prescribed_exercise_id=i.exercise_id,
 performed_exercise_name=e.name,prescribed_exercise_name=e.name
 FROM public.client_exercise_session_items i JOIN public.exercises e ON e.id=i.exercise_id WHERE i.id=l.exercise_item_id;

CREATE FUNCTION public.guard_workout_substitution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_original uuid; v_name text; v_actual text; v_item public.client_exercise_session_items;
BEGIN
 SELECT i.* INTO v_item FROM public.client_exercise_session_items i
 JOIN public.client_exercise_sessions s ON s.id=i.session_id JOIN public.client_exercise_plans p ON p.id=s.plan_id
 WHERE i.id=NEW.exercise_item_id AND s.id=NEW.session_id AND p.client_id=NEW.client_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exercise does not belong to this client session'; END IF;
 v_original:=v_item.exercise_id;
 IF TG_OP='UPDATE' THEN
   IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.exercise_item_id IS DISTINCT FROM OLD.exercise_item_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.log_date IS DISTINCT FROM OLD.log_date THEN
     RAISE EXCEPTION 'Workout history identity cannot change'; END IF;
   IF NEW.performed_exercise_id IS NULL AND OLD.performed_exercise_id IS DISTINCT FROM v_original THEN
     RAISE EXCEPTION 'Refresh this workout before editing a substituted exercise'; END IF;
   NEW.performed_exercise_id:=coalesce(NEW.performed_exercise_id,OLD.performed_exercise_id,v_original);
   IF NEW.performed_exercise_id IS DISTINCT FROM OLD.performed_exercise_id THEN
     RAISE EXCEPTION 'A saved exercise cannot be replaced; retain its workout history'; END IF;
   NEW.prescribed_exercise_id:=OLD.prescribed_exercise_id;
   NEW.prescribed_exercise_name:=OLD.prescribed_exercise_name;
   NEW.performed_exercise_name:=OLD.performed_exercise_name;
   RETURN NEW;
 END IF;
 NEW.performed_exercise_id:=coalesce(NEW.performed_exercise_id,v_original);
 NEW.prescribed_exercise_id:=v_original;
 SELECT name INTO v_name FROM public.exercises WHERE id=v_original;
 SELECT name INTO v_actual FROM public.exercises WHERE id=NEW.performed_exercise_id;
 NEW.prescribed_exercise_name:=v_name; NEW.performed_exercise_name:=v_actual;
 IF NEW.performed_exercise_id<>v_original AND NOT EXISTS(SELECT 1 FROM public.client_exercise_logs old_log WHERE old_log.client_id=NEW.client_id AND old_log.exercise_item_id=NEW.exercise_item_id AND old_log.log_date=NEW.log_date AND old_log.performed_exercise_id=NEW.performed_exercise_id) THEN
   IF coalesce(v_item.prescription_type,'sets_reps')<>'sets_reps' OR coalesce(trim(v_item.notes),'')<>'' OR coalesce(trim(v_item.tempo),'')<>'' THEN
     RAISE EXCEPTION 'Exercise-specific prescription cannot be substituted'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.exercise_alternatives a
     JOIN public.exercises s ON s.id=a.source_exercise_id JOIN public.exercises t ON t.id=a.alternative_exercise_id
     WHERE a.source_exercise_id=v_original AND a.alternative_exercise_id=NEW.performed_exercise_id
       AND a.status IN ('generated','approved') AND s.is_active AND t.is_active
       AND a.source_evidence=jsonb_build_object('name',s.name,'muscle_group',s.muscle_group,'equipment',s.equipment,'description',s.description)
       AND a.target_evidence=jsonb_build_object('name',t.name,'muscle_group',t.muscle_group,'equipment',t.equipment,'description',t.description)) THEN
     RAISE EXCEPTION 'Alternative is unavailable or needs renewed coach review'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_workout_substitution() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER exercise_log_substitution_guard BEFORE INSERT OR UPDATE ON public.client_exercise_logs
 FOR EACH ROW EXECUTE FUNCTION public.guard_workout_substitution();
