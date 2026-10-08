import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const client=id(1), exercise=id(2), plan=id(3), session=id(4), item=id(5);
export async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE client_profiles(id uuid primary key);
 CREATE TABLE client_exercise_plans(id uuid primary key default gen_random_uuid(),client_id uuid references client_profiles,
 template_id uuid,name text not null,description text,overview text,status text default 'active',start_date date,end_date date,updated_at timestamptz default now());
 CREATE TABLE client_exercise_sessions(id uuid primary key default gen_random_uuid(),plan_id uuid references client_exercise_plans on delete cascade,name text,day_number int,notes text);
 CREATE TABLE exercises(id uuid primary key);
 CREATE TABLE client_exercise_session_items(id uuid primary key default gen_random_uuid(),session_id uuid references client_exercise_sessions on delete cascade,exercise_id uuid references exercises,
 order_index int,sets int,reps text,prescription_type text,prescription_text text,rest_seconds int,tempo text,notes text,section_label text,superset_group text);
 CREATE TABLE client_exercise_logs(id uuid primary key,exercise_item_id uuid,session_id uuid,sets_data jsonb,log_date date default '2026-10-05');
 CREATE TABLE client_exercise_session_summaries(id uuid primary key,session_id uuid references client_exercise_sessions on delete cascade,log_date date default '2026-10-05');
 CREATE TABLE client_training_weekly_assignments(id uuid primary key,session_id uuid references client_exercise_sessions on delete cascade,planned_date date,is_recurring bool default false);
 INSERT INTO client_profiles VALUES('${client}'),('${id(11)}'); INSERT INTO exercises VALUES('${exercise}'),('${id(12)}');
 INSERT INTO client_exercise_plans(id,client_id,name,start_date,end_date) VALUES('${plan}','${client}','Original','2026-10-05','2026-12-20');
 INSERT INTO client_exercise_sessions VALUES('${session}','${plan}','Day 1',1,NULL);
 INSERT INTO client_exercise_session_items(id,session_id,exercise_id,order_index,sets,reps) VALUES('${item}','${session}','${exercise}',0,3,'10');
 INSERT INTO client_exercise_logs(id,exercise_item_id,session_id,sets_data) VALUES('${id(6)}','${item}','${session}','[{"weight":60,"reps":10}]');
 INSERT INTO client_exercise_session_summaries(id,session_id) VALUES('${id(7)}','${session}'); INSERT INTO client_training_weekly_assignments(id,session_id) VALUES('${id(8)}','${session}');
 `);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261008130000_preserve_client_exercise_plan_history.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261008134000_guard_exercise_identity_changes.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261008151000_week_specific_exercise_programmes.sql',import.meta.url),'utf8'));
 return db;
}
