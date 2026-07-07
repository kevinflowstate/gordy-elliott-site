import { requireAdmin } from "@/lib/admin-auth";
import {
  isCoachingNoteSourceType,
  normalizeCoachingNoteExtraction,
  type CoachingTaskSuggestion,
} from "@/lib/coaching-notes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function cleanTaskSuggestion(value: unknown): CoachingTaskSuggestion | null {
  if (typeof value === "string") {
    const taskText = value.trim().slice(0, 240);
    return taskText ? { task_text: taskText } : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const taskText = typeof record.task_text === "string" ? record.task_text.trim().slice(0, 240) : "";
  if (!taskText) return null;
  const reason = typeof record.reason === "string" ? record.reason.trim().slice(0, 360) : "";
  return { task_text: taskText, reason: reason || undefined };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_coaching_notes")
    .select("id, client_id, source_type, source_title, source_date, coach_summary, client_summary, coach_notes, priorities, task_suggestions, follow_up_questions, risk_flags, saved_task_ids, client_visible, created_at, created_by")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const rawNotes = typeof body.raw_notes === "string" ? body.raw_notes.trim() : "";
  const sourceType = isCoachingNoteSourceType(body.source_type) ? body.source_type : "other";
  const sourceTitle = typeof body.source_title === "string" ? body.source_title.trim().slice(0, 180) : "";
  const sourceDate = cleanDate(body.source_date);
  const clientVisible = body.client_visible === true;
  const extraction = normalizeCoachingNoteExtraction(body.extraction || body);
  const selectedTasks = Array.isArray(body.selected_task_suggestions)
    ? body.selected_task_suggestions.map(cleanTaskSuggestion).filter(Boolean) as CoachingTaskSuggestion[]
    : [];

  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });
  if (rawNotes.length < 20) return NextResponse.json({ error: "Paste at least a few lines of notes before saving." }, { status: 400 });
  if (rawNotes.length > 30000) return NextResponse.json({ error: "Notes are too long. Keep this first version under 30,000 characters." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: clientExists, error: clientError } = await admin
    .from("client_profiles")
    .select("id")
    .eq("id", clientId)
    .single();

  if (clientError || !clientExists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: note, error: noteError } = await admin
    .from("client_coaching_notes")
    .insert({
      client_id: clientId,
      source_type: sourceType,
      source_title: sourceTitle || null,
      source_date: sourceDate,
      raw_notes: rawNotes,
      coach_summary: extraction.coach_summary || null,
      client_summary: extraction.client_summary || null,
      coach_notes: extraction.coach_notes || null,
      priorities: extraction.priorities,
      task_suggestions: extraction.task_suggestions,
      follow_up_questions: extraction.follow_up_questions,
      risk_flags: extraction.risk_flags,
      client_visible: clientVisible,
      created_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (noteError) return NextResponse.json({ error: noteError.message }, { status: 500 });

  let tasks: Array<{ id: string; task_text: string }> = [];
  if (selectedTasks.length) {
    const { data: savedTasks, error: taskError } = await admin
      .from("client_tasks")
      .insert(selectedTasks.map((task) => ({
        client_id: clientId,
        task_text: task.task_text,
        source: "coach",
      })))
      .select("id, task_text");

    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    tasks = savedTasks || [];

    await admin
      .from("client_coaching_notes")
      .update({
        saved_task_ids: tasks.map((task) => task.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", note.id);
  }

  return NextResponse.json({ note: { ...note, saved_task_ids: tasks.map((task) => task.id) }, tasks });
}
