import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTerraSdkToken, getTerraReferenceId } from "@/lib/terra/client";
import { TERRA_CONSENT_VERSION } from "@/lib/terra/events";
export async function POST(request: Request) {
 const supabase = await createClient();
 const {data:{user}} = await supabase.auth.getUser();
 if (!user) return NextResponse.json({error:"Not authenticated"},{status:401});
 const body = await request.json().catch(()=>({}));
 if (body.provider !== "apple" && body.provider !== "healthconnect") return NextResponse.json({error:"Unsupported native provider"},{status:400});
 if (body.consent !== true) return NextResponse.json({error:"Confirm the health-data notice before connecting."},{status:400});
 const admin = createAdminClient();
 const {data:profile,error:profileError}=await admin.from("client_profiles").select("id").eq("user_id",user.id).maybeSingle();
 if(profileError) return NextResponse.json({error:"Profile lookup failed"},{status:500});
 if(!profile)return NextResponse.json({error:"Client profile not found"},{status:404});
 const attemptStartedAt=new Date().toISOString();
 const referenceId=getTerraReferenceId(profile.id);
 try {
  const credentials=await generateTerraSdkToken();
  const {error}=await admin.from("client_wearable_connections").upsert({client_id:profile.id,provider:body.provider,reference_id:referenceId,status:"pending",connected_at:null,disconnected_at:null,failure_reason:null,last_data_at:null,consent_version:TERRA_CONSENT_VERSION,consented_at:attemptStartedAt,updated_at:attemptStartedAt},{onConflict:"client_id,provider"});
  if(error)throw new Error("Connection could not be saved");
  return NextResponse.json({...credentials,referenceId,attemptStartedAt},{headers:{"Cache-Control":"no-store"}});
 } catch {return NextResponse.json({error:"Couldn't start the health connection. Please try again."},{status:502});}
}
