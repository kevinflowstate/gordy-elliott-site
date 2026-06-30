import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_RECURRENCES = new Set(["none", "weekly", "biweekly", "monthly"]);
const VALID_CATEGORIES = new Set(["wedding", "anniversary", "birthday", "travel", "reminder", "custom"]);

async function getClientContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  if (profile.tier === "ai_only") return { error: NextResponse.json({ error: "Calendar is not available on this plan" }, { status: 403 }) };

  return { admin, user, profile };
}

function toPersonalEventPayload(body: Record<string, unknown>, clientId: string) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const event_date = typeof body.event_date === "string" ? body.event_date : "";
  const event_time = typeof body.event_time === "string" ? body.event_time : "09:00";
  const recurrence = typeof body.recurrence === "string" && VALID_RECURRENCES.has(body.recurrence) ? body.recurrence : "none";
  const category = typeof body.category === "string" && VALID_CATEGORIES.has(body.category) ? body.category : "custom";

  if (!title) return { error: "Title is required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return { error: "event_date must be YYYY-MM-DD" };
  if (!/^\d{2}:\d{2}$/.test(event_time)) return { error: "event_time must be HH:MM" };

  const dateTime = new Date(`${event_date}T${event_time}:00`);
  return {
    payload: {
      client_id: clientId,
      title,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      category,
      event_date_key: event_date,
      event_date: dateTime.toISOString(),
      event_time,
      recurrence,
      recurrence_day: recurrence === "weekly" || recurrence === "biweekly" ? dateTime.getDay() : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
  };
}

function mapPersonalEvent(event: Record<string, unknown>) {
  return {
    ...event,
    event_date: event.event_date_key || event.event_date,
    source: "client",
  };
}

export async function GET() {
  const ctx = await getClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const { data: coachEvents, error } = await admin
    .from("calendar_events")
    .select("*")
    .eq("is_active", true)
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: personalEvents, error: personalError } = await admin
    .from("client_personal_events")
    .select("*")
    .eq("client_id", profile.id)
    .eq("is_active", true)
    .order("event_date", { ascending: true });

  if (personalError) {
    return NextResponse.json({ error: personalError.message }, { status: 500 });
  }

  return NextResponse.json({
    events: [
      ...(coachEvents || []).map((event) => ({ ...event, source: "coach" })),
      ...(personalEvents || []).map(mapPersonalEvent),
    ],
  });
}

export async function POST(request: Request) {
  const ctx = await getClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json().catch(() => ({}));
  const parsed = toPersonalEventPayload(body, profile.id);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await admin
    .from("client_personal_events")
    .insert(parsed.payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: mapPersonalEvent(data) });
}

export async function PATCH(request: Request) {
  const ctx = await getClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const parsed = toPersonalEventPayload(body, profile.id);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await admin
    .from("client_personal_events")
    .update(parsed.payload)
    .eq("id", id)
    .eq("client_id", profile.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ event: mapPersonalEvent(data) });
}

export async function DELETE(request: Request) {
  const ctx = await getClientContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin
    .from("client_personal_events")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
