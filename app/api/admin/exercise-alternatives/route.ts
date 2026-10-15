import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { exerciseEvidence, evidenceMatches, type LibraryExercise } from "@/lib/exercise-alternatives";
import { NextResponse } from "next/server";
export async function GET() {
 const auth=await requireAdmin(); if(!auth.authorized) return NextResponse.json({error:auth.error},{status:auth.status});
 const admin=createAdminClient();
 const [library,profiles,mappings]=await Promise.all([
  admin.from('exercises').select('id,name,muscle_group,equipment,description,is_active').eq('is_active',true).order('name').limit(2000),
  admin.from('exercise_swap_profiles').select('*').limit(2000),
  admin.from('exercise_alternatives').select('*').limit(5000),
 ]);
 if(library.error||profiles.error||mappings.error) return NextResponse.json({error:'Could not load alternative review queue'},{status:500});
 const byId=new Map((library.data||[]).map(e=>[e.id,e]));
 return NextResponse.json({exercises:library.data,profiles:profiles.data,mappings:(mappings.data||[]).map(m=>({...m,stale:!byId.get(m.source_exercise_id)||!byId.get(m.alternative_exercise_id)||!evidenceMatches(byId.get(m.source_exercise_id)!,m.source_evidence)||!evidenceMatches(byId.get(m.alternative_exercise_id)!,m.target_evidence)}))});
}
export async function POST(request:Request) {
 const auth=await requireAdmin(); if(!auth.authorized) return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>null);
 if(!body||!['approve','remove','replace'].includes(body.action)||typeof body.source_id!=='string'||typeof body.target_id!=='string'||body.source_id===body.target_id) return NextResponse.json({error:'Choose two different exercises and an action'},{status:400});
 const admin=createAdminClient(); const {data:exercises,error}=await admin.from('exercises').select('id,name,muscle_group,equipment,description,is_active').in('id',[body.source_id,body.target_id]);
 const source=exercises?.find(e=>e.id===body.source_id) as LibraryExercise|undefined; const target=exercises?.find(e=>e.id===body.target_id) as LibraryExercise|undefined;
 if(error||!source?.is_active||!target?.is_active) return NextResponse.json({error:'Choose active library exercises'},{status:400});
 if(body.action==='remove') {
  const result=await admin.from('exercise_alternatives').update({status:'disabled',reviewed_by:auth.userId,reviewed_at:new Date().toISOString()}).eq('source_exercise_id',source.id).eq('alternative_exercise_id',target.id);
  return NextResponse.json(result.error?{error:result.error.message}:{ok:true},{status:result.error?500:200});
 }
 const required=Array.isArray(body.required_equipment)?body.required_equipment.filter((v:unknown)=>typeof v==='string'&&v.trim()).map((v:string)=>v.trim().slice(0,80)).slice(0,8):[];
 const rationale=typeof body.rationale==='string'?body.rationale.trim().slice(0,600):'';
 if(!rationale||!required.length) return NextResponse.json({error:'Confirm the matching training purpose and all required equipment (use bodyweight if none)'},{status:400});
 const {error:saveError}=await admin.from('exercise_alternatives').upsert({source_exercise_id:source.id,alternative_exercise_id:target.id,status:'approved',source_evidence:exerciseEvidence(source),target_evidence:exerciseEvidence(target),rationale,required_equipment:required,rule_version:'coach-reviewed',reviewed_by:auth.userId,reviewed_at:new Date().toISOString()});
 return NextResponse.json(saveError?{error:saveError.message}:{ok:true},{status:saveError?500:200});
}
