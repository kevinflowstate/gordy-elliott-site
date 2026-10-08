import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientExercisePlan, ExerciseSession } from "../lib/types";
import { copyProgrammeWeek, programmeWeek, programmeToday, programmeSessionsForDate, programmeSessionsForCalendarWeek, programmeSessionCanBePlanned, programmeScheduledSessionForDate, programmeWeeksInRange } from "../lib/exercise-programme";
import { loadExerciseSessionItems, loadExercisePlanSessions } from "../lib/exercise-session-load";
import { buildNativeWorkoutLaunchPayload } from "../lib/native-workout";
import { fixture, id, client, exercise, plan, session, item } from "./helpers/client-plan-fixture";

const source: ExerciseSession = { id:id(20),name:"Strength",day_number:1,week_number:1,items:[{id:id(21),session_id:id(20),exercise_id:exercise,order_index:0,sets:4,reps:"8",superset_group:"pair"},{id:id(22),session_id:id(20),exercise_id:exercise,order_index:1,sets:4,reps:"8",superset_group:"pair"}] };
function programme(): ClientExercisePlan {
 let n=30;
 return { id:id(23),client_id:client,name:"Four weeks",status:"active",start_date:"2026-10-07",programme_weeks:4,programme_timezone:"Europe/London",sessions:copyProgrammeWeek([source],1,[2,3,4],()=>id(n++)),created_at:"",updated_at:"" };
}
const save=(db:Awaited<ReturnType<typeof fixture>>,p:unknown)=>db.query('select save_client_exercise_plan($1::jsonb) as id',[JSON.stringify(p)]);

test("date-only programme weeks cross DST, midnight and mid-calendar-week boundaries correctly; final week repeats",()=>{
 const p=programme();
 assert.equal(programmeWeek(p,"2026-10-13"),1);assert.equal(programmeWeek(p,"2026-10-14"),2);
 assert.equal(programmeWeek(p,"2026-10-25"),3);assert.equal(programmeWeek(p,"2026-10-28"),4);
 assert.equal(programmeWeek(p,"2026-12-15"),4);
 assert.equal(programmeToday("Europe/London",new Date("2026-10-07T23:30:00Z")),"2026-10-08");
 assert.equal(programmeToday("America/New_York",new Date("2026-10-08T00:30:00Z")),"2026-10-07");
 assert.deepEqual(programmeWeeksInRange(p,"2026-10-12","2026-10-18"),[1,2]);
 assert.throws(()=>programmeWeeksInRange(p,"2026-10-12","2026-11-18"),/seven/);
 assert.throws(()=>programmeWeeksInRange(p,"2026-02-30","2026-03-01"),/valid/);
 assert.equal(programmeSessionCanBePlanned(p,source.id,"2026-10-06"),false);
 assert.equal(programmeSessionCanBePlanned(p,source.id,"2026-10-14"),false);
 assert.equal(programmeSessionsForCalendarWeek(p,"2026-10-12").length,2);
 assert.equal(programmeScheduledSessionForDate(p,"2026-10-14")?.week_number,2);
 assert.equal(programmeScheduledSessionForDate(p,"2026-11-04")?.week_number,4);
 const legacy={...p,programme_weeks:null,sessions:[source]};
 assert.equal(programmeSessionsForDate(legacy,"2026-12-15")[0].id,source.id);
});

test("copying weeks produces independent IDs and groups; a deload reaches the existing native bridge only as the chosen session",()=>{
 const p=programme();const deload=p.sessions.find(s=>s.week_number===4)!;
 deload.items[0].sets=2;deload.items[0].reps="5";
 assert.equal(source.items[0].sets,4);assert.equal(p.sessions[0].items[0].sets,4);
 assert.equal(new Set(p.sessions.flatMap(s=>[s.id,...s.items.map(i=>i.id)])).size,12);
 assert.equal(deload.items[0].superset_group,deload.items[1].superset_group);
 assert.notEqual(deload.items[0].superset_group,source.items[0].superset_group);
 assert.throws(()=>copyProgrammeWeek(p.sessions,1,[4]),/empty/);
 const selected=programmeSessionsForDate(p,"2026-10-28")[0];
 const payload=buildNativeWorkoutLaunchPayload({session:selected,date:"2026-10-28",dateLabel:"Today",mode:"workout",sets:{},startedAt:null});
 assert.equal(payload.session.id,deload.id);assert.equal(payload.session.exercises[0].prescription,"2 x 5");
 assert.deepEqual(payload.session.exercises.map(i=>i.id),deload.items.map(i=>i.id));
});

test("coach loading paginates beyond1000 items and limits PostgREST URL chunks; failures return no partial plan",async()=>{
 const rows=Array.from({length:1501},(_,index)=>({id:id(index+100),session_id:id(20),order_index:index}));
 const calls:Array<{ids:string[];from:number}>=[];
 let fail=false;
 const fake={from:()=>({select:()=>({in:(_key:string,ids:string[])=>({order:()=>({range:async(from:number,to:number)=>{calls.push({ids,from});return fail?{data:null,error:{message:"unavailable"}}:{data:ids.includes(id(20))?rows.slice(from,to+1):[],error:null};}})})})})} as unknown as SupabaseClient;
 const result=await loadExerciseSessionItems(fake,Array.from({length:45},(_,index)=>id(20+index)));
 const sessionResult=await loadExercisePlanSessions(fake,[id(20)]);assert.equal(sessionResult.data?.length,1501);
 calls.splice(4);
 assert.equal(result.data?.length,1501);assert.deepEqual(calls.map(call=>call.from),[0,1000,0,0]);assert.ok(calls.every(call=>call.ids.length<=20));
 fail=true;const failed=await loadExerciseSessionItems(fake,[id(20)]);assert.equal(failed.data,null);assert.equal(failed.error,"unavailable");
});

test("weekly save, deload edit and adding a future week preserve old sessions, items, logs and assignments",async()=>{
 const db=await fixture();try{
  const p=programme();p.id="";const result=await save(db,p);p.id=(result.rows[0] as {id:string}).id;
  const first=p.sessions[0];
  await db.query('insert into client_exercise_logs(id,exercise_item_id,session_id,sets_data,log_date) values($1,$2,$3,$4,$5)',[id(90),first.items[0].id,first.id,'[{"weight":60}]',"2026-10-07"]);
  await db.query('insert into client_training_weekly_assignments(id,session_id,planned_date,is_recurring) values($1,$2,$3,false)',[id(91),first.id,"2026-10-07"]);
  p.sessions.find(s=>s.week_number===4)!.items[0].sets=2;
  await save(db,p);let n=500;p.sessions=copyProgrammeWeek(p.sessions,4,[5],()=>id(n++));p.programme_weeks=5;await save(db,p);
  assert.equal((await db.query('select * from client_exercise_logs l join client_exercise_session_items i on i.id=l.exercise_item_id join client_exercise_sessions s on s.id=l.session_id')).rows.length,2);
  assert.equal((await db.query('select * from client_training_weekly_assignments')).rows.length,2);
  assert.equal((await db.query<{sets:number}>('select sets from client_exercise_session_items where id=$1',[first.items[0].id])).rows[0].sets,4);
  assert.equal((await db.query('select * from client_exercise_session_items where id=$1',[item])).rows.length,1);
 }finally{await db.close();}
});

test("timing changes, moving sessions, wrong-week logs/schedules and incomplete programmes fail atomically",async()=>{
 const db=await fixture();try{
  const p=programme();p.id="";const result=await save(db,p);p.id=(result.rows[0] as {id:string}).id;
  const first=p.sessions[0];
  await assert.rejects(db.query('insert into client_exercise_logs(id,exercise_item_id,session_id,sets_data,log_date) values($1,$2,$3,$4,$5)',[id(92),first.items[0].id,first.id,'[]',"2026-10-14"]),/programme week/);
  await assert.rejects(db.query('insert into client_training_weekly_assignments(id,session_id,planned_date,is_recurring) values($1,$2,$3,true)',[id(93),first.id,"2026-10-07"]),/cannot repeat/);
  await db.query('insert into client_exercise_logs(id,exercise_item_id,session_id,sets_data,log_date) values($1,$2,$3,$4,$5)',[id(94),first.items[0].id,first.id,'[]',"2026-10-07"]);
  await assert.rejects(save(db,{...p,start_date:"2026-10-08"}),/timing cannot change/);
  await assert.rejects(save(db,{...p,programme_timezone:"America/New_York"}),/timing cannot change/);
  await assert.rejects(save(db,{...p,sessions:p.sessions.filter(s=>s.week_number!==2)}),/every programme week/);
  const moved=structuredClone(p);moved.sessions[0].week_number=2;moved.sessions[1].week_number=1;
  await assert.rejects(save(db,moved),/cannot move/);
  const stored=(await db.query<{start_date:string}>('select start_date::text from client_exercise_plans where id=$1',[p.id])).rows[0];assert.equal(stored.start_date,"2026-10-07");
  await db.exec('set role authenticated');await assert.rejects(save(db,p),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});

test("static plans with history cannot silently become weekly variants; an unstarted static plan keeps its IDs during conversion",async()=>{
 const db=await fixture();try{
  const convert={id:plan,client_id:client,name:"Convert",start_date:"2026-10-05",programme_weeks:1,programme_timezone:"Europe/London",sessions:[{id:session,name:"Day1",day_number:1,week_number:1,items:[{id:item,exercise_id:exercise,order_index:0,sets:3,reps:"10"}]}]};
  await assert.rejects(save(db,convert),/timing cannot change/);
  await db.exec('delete from client_exercise_logs; delete from client_exercise_session_summaries; delete from client_training_weekly_assignments');
  await save(db,convert);assert.equal((await db.query<{week_number:number}>('select week_number from client_exercise_sessions')).rows[0].week_number,1);
  assert.equal((await db.query<{id:string}>('select id from client_exercise_session_items')).rows[0].id,item);
 }finally{await db.close();}
});
