import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const readings = ['sleep_minutes','sleep_score','hrv_ms','resting_hr_bpm','steps','active_calories','total_calories_burned','training_load','nutrition_calories','protein_g','carbs_g','fat_g','fibre_g','sugar_g','water_ml','readiness_score'];
for(let offset=0;;offset+=500){
 const {data,error}=await db.from('client_wearable_daily_summaries').select('*').eq('workout_count',1).order('id').range(offset,offset+499);
 if(error) throw new Error('Summary audit query failed');
 for(const row of data) if(row.providers?.length===1 && ['whoop','garmin'].includes(row.providers[0]) && readings.every(k=>row[k]==null)) console.log(JSON.stringify({client:row.client_id.slice(0,8),date:row.summary_date,source_payload_ids:row.source_payload_ids}));
 if(data.length<500)break;
}
