import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { exerciseRows } from "../lib/exercise-plan-save";
import type { ExerciseSessionItem } from "../lib/types";
import { fixture, id, client, exercise, plan, session, item } from "./helpers/client-plan-fixture";
const draft=()=>({id:plan,client_id:client,name:'Edited',status:'active',sessions:[{id:session,name:'Day 1',day_number:1,items:[{id:item,exercise_id:exercise,order_index:0,sets:4,reps:'8',prescription_type:'sets_reps'}]}]});
const save=(db:PGlite,p:unknown)=>db.query('select save_client_exercise_plan($1::jsonb) as id',[JSON.stringify(p)]);
test('edits and repeated saves preserve logs, summaries, assignments, IDs and dates; only new exercises get new rows',async()=>{
 const db=await fixture();try{
  const p=draft();p.sessions[0].items.push({...p.sessions[0].items[0],id:id(9),order_index:1});
  await save(db,p);await save(db,p);
  assert.equal((await db.query('select * from client_exercise_session_items')).rows.length,2);
  assert.equal((await db.query<{sets:number}>('select sets from client_exercise_session_items where id=$1',[item])).rows[0].sets,4);
  assert.equal((await db.query('select l.* from client_exercise_logs l join client_exercise_session_items i on i.id=l.exercise_item_id join client_exercise_sessions s on s.id=l.session_id')).rows.length,1);
  for(const table of ['client_exercise_session_summaries','client_training_weekly_assignments']) assert.equal((await db.query(`select * from ${table}`)).rows.length,1);
  const dates=(await db.query<{start:string,end:string}>('select start_date::text as start,end_date::text as end from client_exercise_plans')).rows[0];
  assert.deepEqual(dates,{start:'2026-10-05',end:'2026-12-20'});
  p.sessions[0].items.pop();await save(db,p);assert.equal((await db.query('select * from client_exercise_session_items')).rows.length,1);
 }finally{await db.close();}
});
test('logged removal/replacement and stale saves fail atomically without touching history',async()=>{
 const db=await fixture();try{
  await assert.rejects(db.exec(`delete from client_exercise_session_items where id='${item}'`),/foreign key/);
  const removed=draft();removed.sessions[0].items=[];await assert.rejects(save(db,removed),/Logged exercises/);
  const replaced=draft();replaced.sessions[0].items[0].exercise_id=id(12);await assert.rejects(save(db,replaced),/Existing exercises/);
  await assert.rejects(save(db,{...draft(),expected_updated_at:'2000-01-01T00:00:00Z'}),/Reload this plan/);
  await assert.rejects(save(db,{...draft(),sessions:[{...draft().sessions[0],items:[{...draft().sessions[0].items[0],id:null}]}]}),/Reload this plan/);
  assert.equal((await db.query<{name:string}>('select name from client_exercise_plans')).rows[0].name,'Original');
  assert.equal((await db.query('select * from client_exercise_logs')).rows.length,1);
 }finally{await db.close();}
});
test('cross-client identities, duplicate rows, FK failures and non-service callers fail closed',async()=>{
 const db=await fixture();try{
  await assert.rejects(save(db,{...draft(),client_id:id(11)}),/belong/);
  const duplicate=draft();duplicate.sessions[0].items.push(duplicate.sessions[0].items[0]);await assert.rejects(save(db,duplicate),/duplicate/);
  const invalid=draft();invalid.sessions[0].items.push({...invalid.sessions[0].items[0],id:id(13),exercise_id:id(99)});await assert.rejects(save(db,invalid),/foreign key/);
  assert.equal((await db.query<{name:string}>('select name from client_exercise_plans')).rows[0].name,'Original');
  const other={...draft(),id:null,client_id:id(11)};await assert.rejects(save(db,other),/identity/);
  await db.exec('set role authenticated');await assert.rejects(save(db,draft()),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
test('new plan replacement archives original atomically and retains its logged history',async()=>{
 const db=await fixture();try{
  const p={...draft(),id:null,sessions:[{...draft().sessions[0],id:id(20),items:[{...draft().sessions[0].items[0],id:id(21)}]}]};
  await save(db,p);assert.equal((await db.query<{status:string}>('select status from client_exercise_plans where id=$1',[plan])).rows[0].status,'archived');
  assert.equal((await db.query('select * from client_exercise_logs l join client_exercise_session_items i on i.id=l.exercise_item_id')).rows.length,1);
 }finally{await db.close();}
});
test('an unlogged exercise still cannot change identity beneath a concurrent client log',async()=>{
 const db=await fixture();try{
  await db.exec('delete from client_exercise_logs');
  const p=draft();p.sessions[0].items[0].exercise_id=id(12);
  await assert.rejects(save(db,p),/Existing exercises/);
  assert.equal((await db.query<{exercise_id:string}>('select exercise_id from client_exercise_session_items where id=$1',[item])).rows[0].exercise_id,exercise);
 }finally{await db.close();}
});
test('section labels survive explicit dividers and direct labels on exercise rows',()=>{
 const a={id:item,session_id:session,exercise_id:exercise,order_index:0,sets:3,reps:'10',section_label:'Warm Up'} as ExerciseSessionItem;
 assert.equal(exerciseRows([a],session)[0].section_label,'Warm Up');
 assert.deepEqual(exerciseRows([{...a,exercise_id:'__section__',section_label:'Workout'},{...a,section_label:undefined}, {...a,id:id(9),section_label:undefined}],session).map(x=>x.section_label),['Workout',null]);
});
