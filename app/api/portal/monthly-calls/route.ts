import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { monthStartKey, normalizeProgrammeType, programmeConfig } from "@/lib/programmes";
import { NextResponse } from "next/server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, programme_type, onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  return profile ? { supabase, profile } : null;
}

export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const programme = normalizeProgrammeType(ctx.profile.programme_type);
  const monthStart = monthStartKey();
  const { data, error } = await ctx.supabase
    .from("client_monthly_call_confirmations")
    .select("call_slot, confirmed_at")
    .eq("client_id", ctx.profile.id)
    .eq("month_start", monthStart)
    .order("call_slot");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    programme,
    config: programmeConfig[programme],
    monthStart,
    confirmations: data || [],
  });
}

export async function POST(request: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { call_slot } = await request.json().catch(() => ({}));
  const programme = normalizeProgrammeType(ctx.profile.programme_type);
  const required = programmeConfig[programme].callCount;
  if (!Number.isInteger(call_slot) || call_slot < 1 || call_slot > required) {
    return NextResponse.json({ error: "Invalid call slot" }, { status: 400 });
  }
  // Use the authenticated client so the database policy independently enforces
  // ownership, programme slot count and the current month.
  const monthStart = monthStartKey();
  let { data, error } = await ctx.supabase
    .from("client_monthly_call_confirmations")
    .insert({
      client_id: ctx.profile.id,
      month_start: monthStart,
      call_slot,
      confirmed_at: new Date().toISOString(),
    })
    .select("call_slot, confirmed_at")
    .maybeSingle();
  if (error?.code === "23505") {
    const existing = await ctx.supabase
      .from("client_monthly_call_confirmations")
      .select("call_slot, confirmed_at")
      .eq("client_id", ctx.profile.id)
      .eq("month_start", monthStart)
      .eq("call_slot", call_slot)
      .maybeSingle();
    data = existing.data;
    error = existing.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Call confirmation could not be saved" }, { status: 500 });
  return NextResponse.json({ confirmation: data });
}
