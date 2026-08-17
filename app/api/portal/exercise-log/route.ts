import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { calculateSessionTotals } from "@/lib/strength-progress";

function boundedText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function sanitiseSets(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).map((entry, index) => {
    const set = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const requestedNumber = Number(set.set_number);
    const weight = boundedText(set.weight, 32);
    const reps = boundedText(set.reps, 120);
    const notes = boundedText(set.notes, 240);
    return {
      set_number: Number.isInteger(requestedNumber) && requestedNumber > 0 && requestedNumber <= 20
        ? requestedNumber
        : index + 1,
      weight,
      reps,
      notes,
      completed: typeof set.completed === "boolean"
        ? set.completed
        : Boolean(weight || reps || notes),
    };
  });
}

async function getClientProfile(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  return profile;
}

// GET: fetch exercise logs for a client for a given date
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getClientProfile(user.id);
  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const admin = createAdminClient();

  let query = admin
    .from("client_exercise_logs")
    .select("*")
    .eq("client_id", profile.id);

  if (from && to) {
    query = query.gte("log_date", from).lte("log_date", to);
  } else {
    const targetDate = date || new Date().toISOString().split("T")[0];
    query = query.eq("log_date", targetDate);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
}

// POST: create/update an exercise log entry
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getClientProfile(user.id);
  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const rawEntries = Array.isArray(body.entries) ? body.entries : [body];
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const date = body.date;
  const rawStartedAt = body.session_started_at;

  if (!sessionId) return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  if (rawEntries.length === 0 || rawEntries.length > 50) {
    return NextResponse.json({ error: "entries must contain between 1 and 50 exercises" }, { status: 400 });
  }
  if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  let startedAt: Date | null = null;
  if (rawStartedAt !== undefined && rawStartedAt !== null) {
    if (typeof rawStartedAt !== "string") {
      return NextResponse.json({ error: "session_started_at must be an ISO date" }, { status: 400 });
    }
    startedAt = new Date(rawStartedAt);
    const now = Date.now();
    if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > now + 5 * 60_000 || now - startedAt.getTime() > 6 * 60 * 60_000) {
      return NextResponse.json({ error: "session_started_at is outside the allowed workout window" }, { status: 400 });
    }
  }

  const entries = rawEntries.map((rawEntry) => {
    const entry = rawEntry && typeof rawEntry === "object" ? rawEntry as Record<string, unknown> : {};
    const exerciseItemId = typeof entry.exercise_item_id === "string" ? entry.exercise_item_id : "";
    const safeSets = sanitiseSets(entry.sets_data);
    return {
      exerciseItemId,
      safeSets,
      notes: boundedText(entry.notes, 1000) || null,
    };
  });
  if (entries.some((entry) => !entry.exerciseItemId)) {
    return NextResponse.json({ error: "Every entry requires exercise_item_id" }, { status: 400 });
  }
  if (entries.some((entry) => entry.safeSets === null)) {
    return NextResponse.json({ error: "sets_data must be an array" }, { status: 400 });
  }
  const itemIds = entries.map((entry) => entry.exerciseItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    return NextResponse.json({ error: "Exercise entries must be unique" }, { status: 400 });
  }

  const logDate = typeof date === "string" ? date : new Date().toISOString().split("T")[0];

  const admin = createAdminClient();
  const { data: items, error: itemError } = await admin
    .from("client_exercise_session_items")
    .select("id, session_id")
    .in("id", itemIds);
  if (itemError) return NextResponse.json({ error: "Exercise could not be validated" }, { status: 500 });
  if (!items || items.length !== itemIds.length) {
    return NextResponse.json({ error: "Exercise not found in your plan" }, { status: 404 });
  }
  if (items.some((item) => item.session_id !== sessionId)) {
    return NextResponse.json({ error: "Exercise does not belong to that session" }, { status: 400 });
  }

  const { data: session, error: sessionError } = await admin
    .from("client_exercise_sessions")
    .select("id, plan_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: "Session could not be validated" }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: ownedPlan, error: planError } = await admin
    .from("client_exercise_plans")
    .select("id")
    .eq("id", session.plan_id)
    .eq("client_id", profile.id)
    .maybeSingle();
  if (planError) return NextResponse.json({ error: "Training plan could not be validated" }, { status: 500 });
  if (!ownedPlan) return NextResponse.json({ error: "Exercise not found in your plan" }, { status: 404 });

  const updatedAt = new Date().toISOString();
  const rows = entries.map((entry) => {
    const safeSets = entry.safeSets || [];
    return {
      client_id: profile.id,
      exercise_item_id: entry.exerciseItemId,
      session_id: session.id,
      log_date: logDate,
      sets_data: safeSets,
      completed: safeSets.some((set) => set.completed),
      notes: entry.notes,
      updated_at: updatedAt,
    };
  });
  const { data, error } = await admin
    .from("client_exercise_logs")
    .upsert(rows, { onConflict: "client_id,exercise_item_id,log_date" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = entries.reduce((result, entry) => {
    const entryTotals = calculateSessionTotals(entry.safeSets || []);
    return {
      totalTonnageKg: Math.round((result.totalTonnageKg + entryTotals.totalTonnageKg) * 100) / 100,
      completedSets: result.completedSets + entryTotals.completedSets,
      totalReps: result.totalReps + entryTotals.totalReps,
    };
  }, { totalTonnageKg: 0, completedSets: 0, totalReps: 0 });

  const completedAt = new Date();
  const { data: existingSummary } = await admin
    .from("client_exercise_session_summaries")
    .select("started_at, duration_seconds")
    .eq("client_id", profile.id)
    .eq("session_id", session.id)
    .eq("log_date", logDate)
    .maybeSingle();
  const effectiveStartedAt = startedAt?.toISOString() || existingSummary?.started_at || null;
  const durationSeconds = startedAt
    ? Math.max(0, Math.min(21_600, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)))
    : existingSummary?.duration_seconds ?? null;
  const { data: summary, error: summaryError } = await admin
    .from("client_exercise_session_summaries")
    .upsert({
      client_id: profile.id,
      session_id: session.id,
      log_date: logDate,
      started_at: effectiveStartedAt,
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds,
      total_tonnage_kg: totals.totalTonnageKg,
      completed_sets: totals.completedSets,
      total_reps: totals.totalReps,
      updated_at: completedAt.toISOString(),
    }, { onConflict: "client_id,session_id,log_date" })
    .select()
    .single();

  if (summaryError) {
    console.error("Failed to save exercise session summary:", summaryError.message);
    return NextResponse.json({ error: "Your sets were saved, but the session summary could not be updated. Please tap save again." }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [], log: data?.[0] || null, summary });
}
