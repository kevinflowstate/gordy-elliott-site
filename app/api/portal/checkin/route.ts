import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildFallbackCheckinConfig, normalizeCheckinConfig } from "@/lib/checkin-form";
import { NextResponse } from "next/server";

function getWeekStartIso(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, checkin_day, last_checkin, checkin_form_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const { data: assignedTemplate } = profile.checkin_form_id
    ? await admin
        .from("checkin_forms")
        .select("id, name, config")
        .eq("id", profile.checkin_form_id)
        .maybeSingle()
    : { data: null };

  const { data: defaultTemplate } = assignedTemplate
    ? { data: null }
    : await admin
        .from("checkin_forms")
        .select("id, name, config")
        .eq("is_default", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const effectiveTemplate = assignedTemplate || defaultTemplate;
  let effectiveConfig = effectiveTemplate?.config ? normalizeCheckinConfig(effectiveTemplate.config) : null;

  if (!effectiveConfig) {
    const { data: legacyConfig } = await admin
      .from("form_config")
      .select("config")
      .eq("form_type", "checkin")
      .maybeSingle();
    effectiveConfig = legacyConfig?.config ? normalizeCheckinConfig(legacyConfig.config) : buildFallbackCheckinConfig();
  }

  const weekStart = getWeekStartIso();
  const { data: currentWeekCheckin } = await admin
    .from("checkins")
    .select("*")
    .eq("client_id", profile.id)
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    currentWeekCheckin: currentWeekCheckin || null,
    checkinDay: profile.checkin_day || null,
    lastCheckin: profile.last_checkin || null,
    config: effectiveConfig,
    templateId: effectiveTemplate?.id || profile.checkin_form_id || null,
    templateName: effectiveTemplate?.name || null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, checkin_form_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const { mood, responses } = await request.json();

  if (!mood) {
    return NextResponse.json({ error: "Mood is required" }, { status: 400 });
  }

  const weekStart = getWeekStartIso();
  const { data: currentWeekCheckin } = await admin
    .from("checkins")
    .select("id, week_number")
    .eq("client_id", profile.id)
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get next week number
  const { data: lastCheckin } = await admin
    .from("checkins")
    .select("week_number")
    .eq("client_id", profile.id)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  const weekNumber = currentWeekCheckin?.week_number || ((lastCheckin?.week_number || 0) + 1);

  const payload = {
    client_id: profile.id,
    checkin_form_id: profile.checkin_form_id || null,
    week_number: weekNumber,
    mood,
    // Populate legacy columns for backward compatibility
    wins: responses?.wins || null,
    challenges: responses?.challenges || null,
    questions: responses?.questions || null,
    // Store full responses in JSONB
    responses: responses || null,
  };

  const operation = currentWeekCheckin
    ? admin.from("checkins").update(payload).eq("id", currentWeekCheckin.id)
    : admin.from("checkins").insert(payload);

  const { error: insertError } = await operation;

  if (insertError) {
    const duplicateWeek =
      insertError.code === "23505" ||
      insertError.message?.includes("checkins_client_week_unique");

    if (duplicateWeek) {
      const { data: existing } = await admin
        .from("checkins")
        .select("week_number")
        .eq("client_id", profile.id)
        .eq("week_number", weekNumber)
        .single();

      await admin
        .from("client_profiles")
        .update({ last_checkin: new Date().toISOString() })
        .eq("id", profile.id);

      return NextResponse.json({
        success: true,
        week_number: existing?.week_number || weekNumber,
        duplicate: true,
        updated: Boolean(currentWeekCheckin),
      });
    }

    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update last checkin timestamp
  await admin
    .from("client_profiles")
    .update({ last_checkin: new Date().toISOString() })
    .eq("id", profile.id);

  // Auto-sync progress metrics to body measurements table
  if (responses) {
    const measurement: Record<string, unknown> = {
      client_id: profile.id,
      measured_date: new Date().toISOString().split("T")[0],
    };
    let hasData = false;
    // Map check-in metric IDs to body measurement columns
    if (responses.weight && !isNaN(Number(responses.weight))) { measurement.weight_kg = Number(responses.weight); hasData = true; }
    if (responses.waist && !isNaN(Number(responses.waist))) { measurement.waist_cm = Number(responses.waist); hasData = true; }
    if (responses.chest && !isNaN(Number(responses.chest))) { measurement.chest_cm = Number(responses.chest); hasData = true; }
    if (responses.hips && !isNaN(Number(responses.hips))) { measurement.hips_cm = Number(responses.hips); hasData = true; }
    if (responses.left_arm && !isNaN(Number(responses.left_arm))) { measurement.left_arm_cm = Number(responses.left_arm); hasData = true; }
    if (responses.right_arm && !isNaN(Number(responses.right_arm))) { measurement.right_arm_cm = Number(responses.right_arm); hasData = true; }
    if (responses.left_thigh && !isNaN(Number(responses.left_thigh))) { measurement.left_thigh_cm = Number(responses.left_thigh); hasData = true; }
    if (responses.right_thigh && !isNaN(Number(responses.right_thigh))) { measurement.right_thigh_cm = Number(responses.right_thigh); hasData = true; }
    if (hasData) {
      await admin.from("client_body_measurements").upsert(measurement, { onConflict: "client_id,measured_date", ignoreDuplicates: false });
    }
  }

  return NextResponse.json({
    success: true,
    week_number: weekNumber,
    updated: Boolean(currentWeekCheckin),
  });
}
