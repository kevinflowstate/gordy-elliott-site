import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildFallbackCheckinConfig } from '../lib/checkin-form';

const requireActual=createRequire(new URL('../app/api/portal/checkin/route.ts',import.meta.url));
async function fixture() {
 const config=buildFallbackCheckinConfig(); config.mood_enabled=false; config.questions=config.questions.map(q=>({...q,required:false}));
 const saved: Record<string,unknown>={id:'old',client_id:'owner',created_at:'2026-09-01T12:00:00Z',week_number:1,responses:{wins:'Original win'},form_config_snapshot:config,checkin_form_id:'form',admin_reply:'Original coach reply',replied_at:'2026-09-02T12:00:00Z'};
 const writes:Array<{table:string;payload:Record<string,unknown>;filters:Record<string,unknown>}>=[];
 let measurementFails=false; let concurrentAnswers:Record<string,unknown>|null=null;
 const admin={from(table:string) {
  const filters:Record<string,unknown>={}; let payload:Record<string,unknown>|null=null; let mode='read'; let single=false;
  const b={select(){return b},eq(k:string,v:unknown){filters[k]=v;return b},gte(k:string,v:unknown){filters[`gte:${k}`]=v;return b},order(){return b},limit(){return b},update(p:Record<string,unknown>){payload=p;mode='update';return b},insert(p:Record<string,unknown>){payload=p;mode='insert';return b},upsert(p:Record<string,unknown>){payload=p;mode='upsert';return b},single(){single=true;return Promise.resolve(result())},maybeSingle(){single=true;return Promise.resolve(result())},then(resolve:(x:unknown)=>unknown){return Promise.resolve(result()).then(resolve)}};
  function result():{data:unknown;error:unknown} {
   if(payload) { writes.push({table,payload,filters}); if(table==='checkins') { assert.equal(filters.client_id,'owner');if (!filters.responses || JSON.stringify(saved.responses)===filters.responses) Object.assign(saved,structuredClone(payload)); } if(table==='client_body_measurements'&&concurrentAnswers)saved.responses=concurrentAnswers; return {data:null,error:table==='client_body_measurements'&&measurementFails?{message:'offline'}:null}; }
   if(table==='client_profiles')return {data:{id:'owner',programme_type:'capacity',weight_unit:'lb',checkin_form_id:'form',tier:'coached'},error:null};
   if(table==='checkin_forms')return {data:{id:'form',config},error:null};
   if(table==='checkins'){
    assert.equal(filters.client_id,'owner');
    const found=(!filters.id || filters.id==='old')&&(!filters['gte:created_at'] || String(saved.created_at)>=String(filters['gte:created_at']));
    return {data:single?found?structuredClone(saved):null:found?[saved]:[],error:null};
   }
   throw new Error(`Unexpected table ${table} (${mode})`);
  } return b;
 }};
 const source=await readFile(new URL('../app/api/portal/checkin/route.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:{GET?:(r:Request)=>Promise<Response>;POST?:(r:Request)=>Promise<Response>}={};
 new Function('require','exports',compiled)((name:string)=>name==='@/lib/supabase/admin'?{createAdminClient:()=>admin}:name==='@/lib/supabase/server'?{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user'}}})}})}:name==='@/lib/checkin-replies'?{loadCoachCheckinReplies:async()=>({replies:[],unavailable:false})}:requireActual(name),exports);
 const post=(body:object)=>exports.POST!(new Request('https://example.invalid/api/portal/checkin',{method:'POST',body:JSON.stringify(body)}));
 return {get:(id?:string)=>exports.GET!(new Request(`https://example.invalid/api/portal/checkin${id?`?edit=${id}`:''}`)),post,saved,writes,failMeasurement:()=>{measurementFails=true},recoverMeasurement:()=>{measurementFails=false},concurrentCorrection:(answers:Record<string,unknown>)=>{concurrentAnswers=answers}};
}
test('client reopens an owned historical check-in; original units survive preference changes',async()=>{
 const f=await fixture(); const res=await f.get('old'); assert.equal(res.status,200);const body=await res.json();assert.equal(body.weightUnit,'kg');assert.equal(body.currentWeekCheckin.id,'old');assert.equal(body.editingHistory,true);
 assert.equal((await f.get('another-client')).status,404);
 const fresh=await (await f.get()).json();assert.equal(fresh.weightUnit,'lb');assert.equal(fresh.currentWeekCheckin,null);
});
test('adding pounds to old check-in normalizes chart on original date and preserves reply/timestamps',async()=>{
 const f=await fixture();const res=await f.post({checkin_id:'old',responses:{wins:'Original win',weight:'176.4'},weight_unit:'lb',mood:'okay'});assert.equal(res.status,200);
 assert.equal(f.saved.created_at,'2026-09-01T12:00:00Z');assert.equal(f.saved.admin_reply,'Original coach reply');assert.equal(f.saved.replied_at,'2026-09-02T12:00:00Z');assert.equal(f.saved.week_number,1);
 const metric=f.writes.find(w=>w.table==='client_body_measurements')!;assert.equal(metric.payload.measured_date,'2026-09-01');assert.ok(Math.abs(Number(metric.payload.weight_kg)-80.013694068)<0.000001);
 assert.equal(f.writes.some(w=>w.table==='client_profiles'),false,'historical edit must not reset last_checkin');
});
test('foreign check-in and invalid units/weight fail before writes',async()=>{
 for(const body of [{checkin_id:'foreign',responses:{weight:'80'}},{checkin_id:'old',responses:{weight:'80'},weight_unit:'stones'},{checkin_id:'old',responses:{weight:'-5'},weight_unit:'kg'}]) {
  const f=await fixture();assert.ok((await f.post(body)).status>=400);assert.equal(f.writes.length,0);
 }
});
test('measurement failure is surfaced even when check-in saved',async()=>{
 const f=await fixture();f.failMeasurement();const response=await f.post({checkin_id:'old',responses:{weight:'80'},weight_unit:'kg'});assert.equal(response.status,200);assert.match((await response.json()).measurementWarning,/could not sync/);
});

test('legacy answers survive unrelated historical corrections',async()=>{
 const f=await fixture();f.saved.wins='Legacy win';f.saved.challenges='Legacy challenge';f.saved.questions='Legacy question';f.saved.responses=null;
 const res=await f.post({checkin_id:'old',responses:{weight:'80'},weight_unit:'kg'});assert.equal(res.status,200);
 assert.equal(f.saved.wins,'Legacy win');assert.equal(f.saved.challenges,'Legacy challenge');assert.equal(f.saved.questions,'Legacy question');
});
test('failed weight sync retries the unchanged weight after recovery',async()=>{
 const f=await fixture();f.failMeasurement();await f.post({checkin_id:'old',responses:{weight:'80'},weight_unit:'kg'});
 assert.equal((f.saved.responses as Record<string,unknown>).weight_sync_pending,true);
 f.recoverMeasurement();const res=await f.post({checkin_id:'old',responses:{weight:'80'},weight_unit:'kg'});
 assert.equal((await res.json()).measurementWarning,null);assert.equal(f.writes.filter(w=>w.table==='client_body_measurements').length,2);
 assert.equal((f.saved.responses as Record<string,unknown>).weight_sync_pending,undefined);
});

test('sync marker cleanup cannot replace a concurrent answer correction',async()=>{
 const f=await fixture();const newer={wins:'Newer correction',weight:'80',weight_unit:'kg'};f.concurrentCorrection(newer);
 const res=await f.post({checkin_id:'old',responses:{wins:'Older request',weight:'80'},weight_unit:'kg'});assert.equal(res.status,200);assert.deepEqual(f.saved.responses,newer);
 const cleanup=f.writes.filter(w=>w.table==='checkins').at(-1)!;assert.equal(JSON.parse(String(cleanup.filters.responses)).weight_sync_pending,true);
});
test('explicitly cleared support answers stay cleared',async()=>{
 const f=await fixture();f.saved.responses={priority_message:'Old priority',support_ask:'Old ask'};
 await f.post({checkin_id:'old',responses:{priority_message:'',support_ask:''},weight_unit:'kg'});
 assert.equal((f.saved.responses as Record<string,unknown>).priority_message,'');assert.equal((f.saved.responses as Record<string,unknown>).support_ask,'');
});
