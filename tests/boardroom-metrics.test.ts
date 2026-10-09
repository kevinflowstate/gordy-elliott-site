import assert from 'node:assert/strict';
import test from 'node:test';
import {checkinReminderDay} from '../lib/checkin-reminder';
import {businessMetricTrends,formatBusinessMetric} from '../lib/boardroom-metrics';
import {contextFromCheckin,checkinAnswers} from '../lib/checkin-message';
import {computeClientAttention} from '../lib/client-attention';
import {buildFallbackCheckinConfig} from '../lib/checkin-form';
import {programmeShowsPortalPath,programmeAllowsDocuments} from '../lib/programmes';
import type {CheckIn,CheckinFormConfig} from '../lib/types';
const config:CheckinFormConfig={...buildFallbackCheckinConfig('boardroom'),progress_tracking:[{id:'sales',label:'Booked',type:'number',kind:'money',unit:'£',enabled:true}]};
const row=(date:string,responses:Record<string,string>,snapshot:CheckinFormConfig|null=config)=>({created_at:date,responses,form_config_snapshot:snapshot} as CheckIn);
test('business trends preserve zero, order dates, omit blanks/invalid numbers, and use submitted question snapshot',()=>{
 const edited={...config,progress_tracking:[{id:'sales',label:'Hours',type:'number',kind:'hours',unit:'hours',enabled:true}] } as CheckinFormConfig;
 const trends=businessMetricTrends([row('2026-10-09',{sales:'0'}),row('2026-10-08',{sales:'1200'}),row('2026-10-10',{sales:''}),row('2026-10-11',{sales:'NaN'}),row('2026-10-12',{sales:'5'},edited)],edited);
 assert.equal(trends.length,2);assert.equal(trends[0].metric.label,'Booked');assert.deepEqual(trends[0].points.map(p=>p.value),[1200,0]);assert.equal(trends[1].metric.unit,'hours');assert.equal(formatBusinessMetric(trends[0].metric,0),'£0.00');
 assert.deepEqual(businessMetricTrends([row('2026-10-09',{sales:'0'},null)]),[]);
});
test('Boardroom navigation hides fitness routes and children but keeps plan, check-ins, messages, documents and education',()=>{
 for(const path of ['/portal/exercise-plan','/portal/exercise-plan/run','/portal/nutrition-plan','/portal/daily-tracker','/portal/ai','/portal/cycle','/portal/progress','/portal/gallery','/portal/connected-apps']){assert.equal(programmeShowsPortalPath('boardroom',path),false);assert.equal(programmeShowsPortalPath('capacity',path),true)}
 for(const path of ['/portal','/portal/plan','/portal/checkin','/portal/business-progress','/portal/inbox','/portal/documents','/portal/training'])assert.equal(programmeShowsPortalPath('boardroom',path),true);
 assert.equal(programmeAllowsDocuments('boardroom'),true);assert.equal(programmeAllowsDocuments('shift'),false);
});

test('Boardroom attention never uses fitness signals even when old monitoring preferences enable them',()=>{
 const now=Date.parse('2026-10-09T12:00:00Z');const base={createdAt:'2026-09-01T12:00:00Z',lastLogin:'2026-10-09T12:00:00Z',lastCheckin:'2026-10-09T12:00:00Z',hasActiveTrainingPlan:true,hasActiveNutritionPlan:true,hasWearableConnection:true,preferences:{monitor_training:true,monitor_daily_metrics:true,monitor_nutrition:true,monitor_wearables:true},now};
 assert.deepEqual(computeClientAttention({...base,programmeType:'boardroom'}).reasons,[]);
 assert.ok(computeClientAttention({...base,programmeType:'capacity'}).reasons.length>0);
 const overdue=computeClientAttention({...base,programmeType:'boardroom',lastCheckin:'2026-09-10T12:00:00Z',lastLogin:'2026-09-10T12:00:00Z'});
 assert.deepEqual(overdue.reasons.map(r=>r.signal),['login','checkin']);
});

test('check-in details use the submitted business labels after current form changes',()=>{
 const current={...config,progress_tracking:[{...config.progress_tracking![0],label:'New label',unit:'hours',kind:'hours' as const}]};
 const submitted={...row('2026-10-09',{sales:'1200'}),mood:'okay' as const};
 const context=contextFromCheckin(submitted,current);
 assert.equal(context.mood,null);
 assert.equal(contextFromCheckin({...submitted,form_config_snapshot:{...config,mood_enabled:true}}).mood,'okay');
 assert.equal(checkinAnswers(context).find(a=>a.key==='sales')?.label,'Booked (£)');
});

test('business reminders follow each approved personal form and wait until full access is switched on',()=>{
 const profile={programme_type:'boardroom',onboarding_status:'active',checkin_form_id:'personal',checkin_day:'Friday'};const config={programme_type:'boardroom',checkin_day:'tuesday'};
 assert.equal(checkinReminderDay(profile,config,'monday'),'friday');
 assert.equal(checkinReminderDay({...profile,checkin_day:null},config,'monday'),'tuesday');
 assert.equal(checkinReminderDay({...profile,onboarding_status:'invited'},config,'monday'),null);
 assert.equal(checkinReminderDay({...profile,checkin_form_id:null},config,'monday'),null);
 assert.equal(checkinReminderDay(profile,{programme_type:'capacity'},'monday'),null);
 assert.equal(checkinReminderDay({...profile,programme_type:'capacity'},config,'monday'),'monday');
});
