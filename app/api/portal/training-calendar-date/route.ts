import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { programmeCalendarWeekStart, programmeDateDay } from "@/lib/exercise-programme";
import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMonday(value: unknown): value is string {
  return typeof value === "string" && programmeDateDay(value) !== null && programmeCalendarWeekStart(value) === value;
}

async function readRequest(request: Request) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const body = await request.json().catch(() => null);
  if (!body || !UUID.test(body.plan_id) || !UUID.test(body.session_id) || !isMonday(body.source_week_start)) {
    return { error: NextResponse.json({ error: "Choose a workout to move." }, { status: 400 }) };
  }
  return { user, body: body as { plan_id: string; session_id: string; source_week_start: string; planned_date?: unknown } };
}

function rpcError(error: { code?: string; message: string }) {
  if (error.code === "23505") return NextResponse.json({ error: "That date already has a planned session." }, { status: 409 });
  if (error.code === "P0001") return NextResponse.json({ error: `${error.message}.` }, { status: 409 });
  console.error("training calendar date failed:", error.message);
  return NextResponse.json({ error: "Couldn't update the workout date. Please try again." }, { status: 500 });
}

/** Moves one occurrence of a workout (its original Monday week) to an actual calendar date. */
export async function POST(request: Request) {
  const parsed = await readRequest(request);
  if ("error" in parsed) return parsed.error;
  const { user, body } = parsed;
  if (typeof body.planned_date !== "string" || programmeDateDay(body.planned_date) === null) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }
  const admin = createAdminClient();

  // Choosing the workout's own original date is the same as undoing the move.
  const { data: profile } = await admin.from("client_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (profile) {
    const { data: original } = await admin
      .from("client_training_weekly_assignments")
      .select("planned_date")
      .eq("client_id", profile.id)
      .eq("plan_id", body.plan_id)
      .eq("session_id", body.session_id)
      .eq("week_start", body.source_week_start)
      .maybeSingle();
    if (original?.planned_date === body.planned_date) {
      const { error } = await admin.rpc("clear_training_calendar_date", {
        p_user_id: user.id, p_plan_id: body.plan_id, p_session_id: body.session_id, p_source_week: body.source_week_start,
      });
      if (error) return rpcError(error);
      return NextResponse.json({ override: null, restored: true });
    }
  }

  const { data, error } = await admin.rpc("save_training_calendar_date", {
    p_user_id: user.id,
    p_plan_id: body.plan_id,
    p_session_id: body.session_id,
    p_source_week: body.source_week_start,
    p_date: body.planned_date,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ override: data, restored: false });
}

/** Undoes a move, restoring the workout's original schedule exactly. */
export async function DELETE(request: Request) {
  const parsed = await readRequest(request);
  if ("error" in parsed) return parsed.error;
  const { user, body } = parsed;
  const { data, error } = await createAdminClient().rpc("clear_training_calendar_date", {
    p_user_id: user.id, p_plan_id: body.plan_id, p_session_id: body.session_id, p_source_week: body.source_week_start,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ restored: Boolean(data) });
}
