import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { monthlyReviewWindow, foundationsMidnight, foundationsReviewAnswers, reviewPeriodMatches } from '@/lib/foundations';
import { notifyClientUser } from '@/lib/client-notifications';
import { NextResponse } from 'next/server';
async function context(clientId: string) {
 const admin=createAdminClient();
 const {data:profile,error}=await admin.from('client_profiles').select('id,user_id,start_date,programme_type').eq('id',clientId).maybeSingle();
 if(error) throw new Error('Could not load client');
 if(!profile || profile.programme_type!=='foundations') return null;
 return {admin,profile,window:monthlyReviewWindow(profile.start_date)};
}
export async function GET(request:Request) {
 const auth=await requireAdmin();if(!auth.authorized)return NextResponse.json({error:auth.error},{status:auth.status});
 const ctx=await context(new URL(request.url).searchParams.get('client')||'');
 if(!ctx)return NextResponse.json({error:'Foundations client not found'},{status:404});
 const {admin,profile,window}=ctx;
 const [{data:reviews,error},{data:checkins,error:checkinError}]=await Promise.all([
  admin.from('foundations_monthly_reviews').select('id,period_start,period_end,response,reviewed_at,message_id').eq('client_id',profile.id).order('period_start',{ascending:false}).limit(12),
  admin.from('checkins').select('id,created_at,mood,wins,challenges,questions,responses,form_config_snapshot').eq('client_id',profile.id).gte('created_at',foundationsMidnight(window.periodStart)).lt('created_at',foundationsMidnight(window.periodEnd)).order('created_at',{ascending:true})
 ]);
 if(error||checkinError)return NextResponse.json({error:'Could not load monthly review'},{status:500});
 return NextResponse.json({window,reviews:reviews||[],checkins:(checkins||[]).map(c=>({...c,answers:foundationsReviewAnswers({submitted_at:c.created_at,mood:c.mood,wins:c.wins,challenges:c.challenges,questions:c.questions,responses:c.responses,config:c.form_config_snapshot})})),completed:reviews?.some(r=>r.period_start===window.periodStart)||false});
}
export async function POST(request:Request) {
 const auth=await requireAdmin();if(!auth.authorized)return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>({}));
 const response=typeof body.response==='string'?body.response.trim():'';
 if(!response||response.length>4000)return NextResponse.json({error:'Write a review of up to 4000 characters'},{status:400});
 const ctx=await context(String(body.client_id||''));if(!ctx)return NextResponse.json({error:'Foundations client not found'},{status:404});
 const {admin,profile,window}=ctx;
 if(!reviewPeriodMatches(window,body.period_start,body.period_end))return NextResponse.json({error:"The review period changed while this draft was open. Reload and check the period before sending."},{status:409});
 if(!window.due)return NextResponse.json({error:`The first monthly review is due ${window.periodEnd}`},{status:409});
 const {data,error}=await admin.rpc('save_foundations_review',{p_admin_id:auth.userId,p_client_id:profile.id,p_start:window.periodStart,p_end:window.periodEnd,p_response:response});
 if(error)return NextResponse.json({error:error.code==='23505'?'This month already has a review. You can send any extra updates in DMs.':'Could not save monthly review'},{status:error.code==='23505'?409:500});
 await notifyClientUser(profile.user_id,{title:'Your monthly review from Gordy',message:'Your Foundations review is ready to read.',link:'/portal/inbox',tag:`foundations-review-${data}`});
 return NextResponse.json({saved:true});
}
