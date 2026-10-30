import { createClient } from '@supabase/supabase-js';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const headers={'dev-id':process.env.TERRA_DEV_ID,'x-api-key':process.env.TERRA_API_KEY};
if(!headers['dev-id']||!headers['x-api-key']) throw new Error('Terra credentials are required');
const response=await fetch('https://api.tryterra.co/v2/subscriptions',{headers,signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error(`Subscriptions lookup HTTP ${response.status}`);
const body=await response.json();const users=Array.isArray(body)?body:body.users;
if(!Array.isArray(users))throw new Error('Unexpected subscriptions response; refusing to apply');
for(const user of users){
 const match=/^client:([0-9a-f-]{36})$/i.exec(user.reference_id||'');if(!match)continue;
 const {data,error}=await db.from('client_profiles').select('id').eq('id',match[1]).maybeSingle();
 if(error)throw new Error('Profile lookup failed; refusing to apply');if(data)continue;
 console.log(JSON.stringify({provider:user.provider,user_id:user.user_id,reference:user.reference_id,mode:process.argv.includes('--apply')?'apply':'dry-run'}));
 if(process.argv.includes('--apply')){
  if(!/^[0-9a-f-]{36}$/i.test(user.user_id))throw new Error('Invalid Terra user id');
  const result=await fetch('https://api.tryterra.co/v2/auth/deauthenticateUser?'+new URLSearchParams({user_id:user.user_id}),{method:'DELETE',headers,signal:AbortSignal.timeout(10000)});
  if(!result.ok&&result.status!==404)throw new Error(`Deauthentication HTTP ${result.status}`);
 }
}
