import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
const requireActual=createRequire(new URL('../app/api/admin/clients/[id]/route.ts',import.meta.url));
async function fixture(programme:string, templateProgramme?:string, authorized=true){
 const writes:Record<string,unknown>[]=[]; const profile={user_id:'fictional-user',programme_type:programme,checkin_form_id:'personal',onboarding_status:'active',activated_at:'2026-09-01T00:00:00Z'};
 const admin={from(table:string){let writing=false;const b={select(){return b},eq(){return b},update(payload:Record<string,unknown>){writes.push(payload);writing=true;return b},maybeSingle(){return Promise.resolve({data:table==='client_profiles'?writing?{...profile,...writes.at(-1)}:profile:table==='checkin_forms'?{config:{programme_type:templateProgramme}}:null,error:null})}};return b}};
 const exports:{PATCH?:(req:Request,context:unknown)=>Promise<Response>}={};const source=await readFile(new URL('../app/api/admin/clients/[id]/route.ts',import.meta.url),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',compiled)((name:string)=>name==='@/lib/admin-auth'?{requireAdmin:async()=>({authorized,userId:'fictional-admin',status:403,error:'Forbidden'})}:name==='@/lib/supabase/admin'?{createAdminClient:()=>admin}:name==='@/lib/admin-data'?{}:name==='@/lib/client-notifications'?{notifyClientUser:async()=>{throw new Error('No notifications expected in these cases')}}:requireActual(name),exports);
 return {writes,call:(body:Record<string,unknown>)=>exports.PATCH!(new Request('https://example.invalid/api/admin/clients/fictional',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'fictional'})})};
}
test('fitness programme changes preserve personal check-in assignments; crossing Boardroom boundary clears them',async()=>{
 const fitness=await fixture('capacity');assert.equal((await fitness.call({programme_type:'shift'})).status,200);assert.equal('checkin_form_id' in fitness.writes[0],false);
 for(const [from,to] of [['capacity','boardroom'],['boardroom','capacity']]){const f=await fixture(from);assert.equal((await f.call({programme_type:to})).status,200);assert.equal(f.writes[0].checkin_form_id,null)}
});
test('personal business templates can be assigned, but incompatible templates and body updates cannot',async()=>{
 const f=await fixture('boardroom','boardroom');assert.equal((await f.call({checkin_form_id:'personal'})).status,200);assert.equal(f.writes[0].checkin_form_id,'personal');
 for(const [programme,template] of [['boardroom','capacity'],['capacity','boardroom']]){const mismatch=await fixture(programme,template);assert.equal((await mismatch.call({checkin_form_id:'personal'})).status,400);assert.equal(mismatch.writes.length,0)}
 const body=await fixture('boardroom');assert.equal((await body.call({sex:'female'})).status,400);assert.equal(body.writes.length,0);
 const denied=await fixture('boardroom','boardroom',false);assert.equal((await denied.call({checkin_form_id:'personal'})).status,403);assert.equal(denied.writes.length,0);
});
