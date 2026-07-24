import { requireAdmin } from "@/lib/admin-auth";
import { londonDateKey } from "@/lib/early-win";
import {
  WEEK_KEY_PATTERN,
  isCallType,
  londonWeekKey,
  parseDateKey,
  trimmedOrNull,
} from "@/lib/founder-compliance";
import { loadComplianceRecords, loadComplianceSummary } from "@/lib/founder-compliance-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getProfile(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  return admin
    .from("client_profiles")
    .select("id, start_date, experience_mode")
    .eq("id", clientId)
    .maybeSingle();
}

async function currentUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const [summary, records] = await Promise.all([
      loadComplianceSummary(admin, clientId, profile.start_date || null),
      loadComplianceRecords(admin, clientId),
    ]);
    return NextResponse.json({ summary, attendance: records.attendance, whatsapp: records.whatsapp });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Compliance records could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const record = typeof body.record === "string" ? body.record : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  if (record !== "call" && record !== "whatsapp") {
    return NextResponse.json({ error: "record must be 'call' or 'whatsapp'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const note = trimmedOrNull(body.note, 500);
  if (note === undefined) {
    return NextResponse.json({ error: "The note is limited to 500 characters" }, { status: 400 });
  }
  if (typeof body.attended !== "boolean" && record === "call") {
    return NextResponse.json({ error: "attended must be true or false" }, { status: 400 });
  }
  if (typeof body.helped !== "boolean" && record === "whatsapp") {
    return NextResponse.json({ error: "helped must be true or false" }, { status: 400 });
  }
  const recordedBy = await currentUserId();

  if (record === "call") {
    if (!isCallType(body.call_type)) {
      return NextResponse.json({ error: "call_type must be 'coaching_call' or 'strategy_call'" }, { status: 400 });
    }
    const today = londonDateKey(new Date());
    const callDate = body.call_date === undefined || body.call_date === "" ? today : parseDateKey(body.call_date);
    if (!callDate) return NextResponse.json({ error: "Invalid call date" }, { status: 400 });
    if (callDate > today) {
      return NextResponse.json({ error: "A call cannot be recorded before it has happened" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("client_call_attendance")
      .insert({
        client_id: clientId,
        call_date: callDate,
        call_type: body.call_type,
        attended: body.attended,
        note,
        recorded_by: recordedBy,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ record: data });
  }

  const currentWeek = londonWeekKey(new Date());
  const weekKey = body.week_key === undefined || body.week_key === ""
    ? currentWeek
    : typeof body.week_key === "string" && WEEK_KEY_PATTERN.test(body.week_key)
      ? body.week_key
      : null;
  if (!weekKey) return NextResponse.json({ error: "week_key must look like 2026-W30" }, { status: 400 });
  if (weekKey > currentWeek) {
    return NextResponse.json({ error: "A future week cannot be recorded yet" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("client_whatsapp_help")
    .upsert(
      {
        client_id: clientId,
        week_key: weekKey,
        helped: body.helped,
        note,
        recorded_by: recordedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,week_key" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const recordId = typeof body.id === "string" ? body.id : "";
  if (!recordId) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (body.record !== "call") {
    return NextResponse.json({ error: "Only call records are edited here; save a WhatsApp week again to change it" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.attended !== undefined) {
    if (typeof body.attended !== "boolean") {
      return NextResponse.json({ error: "attended must be true or false" }, { status: 400 });
    }
    updates.attended = body.attended;
  }
  if (body.call_type !== undefined) {
    if (!isCallType(body.call_type)) {
      return NextResponse.json({ error: "call_type must be 'coaching_call' or 'strategy_call'" }, { status: 400 });
    }
    updates.call_type = body.call_type;
  }
  if (body.call_date !== undefined) {
    const callDate = parseDateKey(body.call_date);
    const today = londonDateKey(new Date());
    if (!callDate || callDate > today) {
      return NextResponse.json({ error: "Invalid call date" }, { status: 400 });
    }
    updates.call_date = callDate;
  }
  if (body.note !== undefined) {
    const note = trimmedOrNull(body.note, 500);
    if (note === undefined) {
      return NextResponse.json({ error: "The note is limited to 500 characters" }, { status: 400 });
    }
    updates.note = note;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_call_attendance")
    .update(updates)
    .eq("id", recordId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Call record not found" }, { status: 404 });
  return NextResponse.json({ record: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const record = url.searchParams.get("record");
  const recordId = url.searchParams.get("id");
  if (!recordId) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (record !== "call" && record !== "whatsapp") {
    return NextResponse.json({ error: "record must be 'call' or 'whatsapp'" }, { status: 400 });
  }

  const table = record === "call" ? "client_call_attendance" : "client_whatsapp_help";
  const admin = createAdminClient();
  const { error } = await admin.from(table).delete().eq("id", recordId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
