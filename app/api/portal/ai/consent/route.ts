import { NextResponse } from "next/server";
import { AI_CONSENT_VERSION } from "@/lib/ai-consent";
import { getClientAIConsent } from "@/lib/ai-consent-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("client_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Unable to check AI sharing" }, { status: 503 }) };
  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  return { admin, profile, user };
}

export async function GET() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  try {
    return NextResponse.json(await getClientAIConsent(ctx.admin, ctx.profile.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to check AI sharing" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.granted !== "boolean" || body.version !== AI_CONSENT_VERSION) {
    return NextResponse.json({ error: "Review the current AI sharing information before choosing." }, { status: 400 });
  }
  const { data, error } = await ctx.admin.from("client_ai_consent_events").insert({
    client_id: ctx.profile.id, user_id: ctx.user.id,
    consent_version: AI_CONSENT_VERSION, granted: body.granted,
  }).select("created_at").single();
  if (error) return NextResponse.json({ error: "Your AI sharing choice could not be saved. Please try again." }, { status: 503 });
  return NextResponse.json({ granted: body.granted, version: AI_CONSENT_VERSION, updatedAt: data.created_at }, { headers: { "Cache-Control": "no-store" } });
}
