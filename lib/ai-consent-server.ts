import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { AI_CONSENT_VERSION, type AIConsentState } from "@/lib/ai-consent";

export async function getClientAIConsent(admin: SupabaseClient, clientId: string): Promise<AIConsentState> {
  const { data, error } = await admin.from("client_ai_consent_state")
    .select("granted, consent_version, created_at").eq("client_id", clientId).maybeSingle();
  if (error) throw new Error("AI permission could not be checked");
  return {
    granted: data?.granted === true && data.consent_version === AI_CONSENT_VERSION,
    version: AI_CONSENT_VERSION,
    updatedAt: data?.created_at || null,
  };
}

export async function requireClientAIConsent(admin: SupabaseClient, clientId: string) {
  try {
    if ((await getClientAIConsent(admin, clientId)).granted) return null;
    return NextResponse.json({ code: "AI_CONSENT_REQUIRED", error: "AI sharing is off. The client can choose whether to enable it in Settings > AI sharing." }, { status: 403 });
  } catch {
    return NextResponse.json({ code: "AI_CONSENT_UNAVAILABLE", error: "AI permission could not be checked. Please try again." }, { status: 503 });
  }
}
