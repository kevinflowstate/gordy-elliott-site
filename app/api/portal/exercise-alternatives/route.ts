import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evidenceMatches, itemAllowsSwap } from "@/lib/exercise-alternatives";
import { NextResponse } from "next/server";
export async function GET(request:Request) {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:'Not authenticated'},{status:401});
 const admin=createAdminClient(); const sessionId=new URL(request.url).searchParams.get('session_id');
 const {data:profile}=await admin.from('client_profiles').select('id').eq('user_id',user.id).single();
 const {data:session}=await admin.from('client_exercise_sessions').select('id,plan_id').eq('id',sessionId||'').maybeSingle();
 const {data:plan}=session&&profile?await admin.from('client_exercise_plans').select('id').eq('id',session.plan_id).eq('client_id',profile.id).maybeSingle():{data:null};
 if(!plan) return NextResponse.json({error:'Session not found'},{status:404});
 const {data:items,error}=await admin.from('client_exercise_session_items').select('id,exercise_id,prescription_type,notes,tempo').eq('session_id',session!.id);
 if(error) return NextResponse.json({error:'Could not load exercises'},{status:500});
 const ids=(items||[]).filter(itemAllowsSwap).map(i=>i.exercise_id);
 if(!ids.length) return NextResponse.json({alternatives:{}});
 const {data:rows,error:mapError}=await admin.from('exercise_alternatives').select('*, source:exercises!source_exercise_id(*), exercise:exercises!alternative_exercise_id(*)').in('source_exercise_id',ids).in('status',['generated','approved']).limit(2000);
 if(mapError) return NextResponse.json({error:'Could not load alternatives'},{status:500});
 const alternatives:Record<string,unknown[]>={};
 for(const item of items||[]) {
  alternatives[item.id]=itemAllowsSwap(item)?(rows||[]).filter(row=>row.source_exercise_id===item.exercise_id&&row.source?.is_active&&row.exercise?.is_active&&evidenceMatches(row.source,row.source_evidence)&&evidenceMatches(row.exercise,row.target_evidence)).map(row=>({exercise:row.exercise,status:row.status,rationale:row.rationale,required_equipment:row.required_equipment})):[];
 }
 return NextResponse.json({alternatives});
}
