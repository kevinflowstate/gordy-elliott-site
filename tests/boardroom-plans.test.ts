import assert from 'node:assert/strict';
import test from 'node:test';
import {validateBusinessPlan, saveBusinessPlan} from '@/lib/business-plans';
const uid = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const plan = () => ({id:uid(1),client_id:uid(2),summary:'Grow sustainably',status:'active',phases:[{id:uid(3),name:'First milestone',notes:'Review progress',linked_trainings:[],items:[{id:uid(4),title:'Speak to five prospects',completed:false}]}]});
test('business draft defaults to 90 days with stable item IDs',()=> { const value = validateBusinessPlan(plan()); assert.equal(value.duration_days,90); assert.equal(value.title,'Business Plan'); assert.equal(value.phases[0].items[0].id,uid(4)); });
test('reject malformed dates, duplicate IDs and invalid lengths before writes',()=> {assert.throws(()=>validateBusinessPlan({...plan(),start_date:'2026-02-30'})); assert.throws(()=>validateBusinessPlan({...plan(),duration_days:0})); const value=plan();value.phases[0].items[0].id=uid(3);assert.throws(()=>validateBusinessPlan(value)); });
test('save calls only atomic RPC and returns transaction errors',async()=> {let calls=0; const result=await saveBusinessPlan({rpc:async(name,args)=>{calls++;assert.equal(name,'save_business_plan');assert.equal(args.payload.client_id,uid(2));return {error:{message:'Plan belongs to another client'}};}},plan());assert.equal(calls,1);assert.equal(result.error,'Plan belongs to another client');});
test('invalid draft never reaches persistence',async()=> {let calls=0;const result=await saveBusinessPlan({rpc:async()=>{calls++;return {error:null};}}, {...plan(),summary:''});assert.ok(result.error);assert.equal(calls,0);});
