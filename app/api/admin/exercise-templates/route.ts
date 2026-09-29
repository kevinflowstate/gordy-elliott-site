import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { normalisePrescriptionType } from "@/lib/exercise-prescriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { ExerciseTemplate, ExerciseSessionItem } from "@/lib/types";

export function validateTemplate(template: ExerciseTemplate): string | null {
  if (!template.name?.trim()) return "Give the template a name.";
  if (!Array.isArray(template.sessions)) return "Template sessions are required.";
  for (const [sessionIndex, session] of template.sessions.entries()) {
    if (!session.name?.trim()) return `Session ${sessionIndex + 1} needs a name.`;
    if (!Number.isInteger(session.day_number) || session.day_number < 1) return `Session ${sessionIndex + 1} needs a valid day.`;
    if (!Array.isArray(session.items)) return `Session ${sessionIndex + 1} has invalid exercises.`;
    for (const [itemIndex, item] of session.items.entries()) {
      if (item.exercise_id === "__section__") continue;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.exercise_id || "")) return `Exercise ${itemIndex + 1} in ${session.name} is invalid.`;
      if (!Number.isInteger(item.sets) || item.sets < 0 || !item.reps?.trim()) return `Exercise ${itemIndex + 1} in ${session.name} needs a valid target.`;
    }
  }
  return null;
}

export function exerciseRows(items: ExerciseSessionItem[], sessionId: string) {
  let section: string | null = null;
  let firstInSection = false;
  return items.flatMap((item, index) => {
    if (item.exercise_id === "__section__") {
      section = item.section_label?.trim() || "Section";
      firstInSection = true;
      return [];
    }
    const row = {
      session_id: sessionId,
      exercise_id: item.exercise_id,
      order_index: index,
      sets: item.sets,
      reps: item.reps,
      prescription_type: normalisePrescriptionType(item.prescription_type),
      prescription_text: item.prescription_text || null,
      rest_seconds: item.rest_seconds ?? null,
      tempo: item.tempo || null,
      notes: item.notes || null,
      section_label: firstInSection ? section : null,
      superset_group: item.superset_group || null,
    };
    firstInSection = false;
    return [row];
  });
}

// GET: Fetch all active templates with nested sessions and items
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  // Fetch templates
  const { data: templates, error: tError } = await admin
    .from("exercise_training_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (tError) return dbError(tError, "Couldn't load training templates. Try again.");
  if (!templates || templates.length === 0) return NextResponse.json({ templates: [] });

  const templateIds = templates.map((t) => t.id);

  // Fetch sessions for those templates
  const { data: sessions } = await admin
    .from("exercise_training_sessions")
    .select("*")
    .in("template_id", templateIds)
    .order("day_number", { ascending: true });

  const sessionIds = (sessions || []).map((s) => s.id);

  // Fetch items joined with exercises
  const { data: items } = sessionIds.length
    ? await admin
        .from("exercise_training_session_items")
        .select("*, exercise:exercises(id, name, muscle_group, equipment, description)")
        .in("session_id", sessionIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble nested structure using Maps
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
    // If this item has a section_label, insert a section divider before it
    if (item.section_label) {
      list.push({
        id: `section-${item.id}`,
        session_id: item.session_id,
        exercise_id: "__section__",
        order_index: item.order_index - 0.5,
        sets: 0,
        reps: "",
        rest_seconds: null,
        tempo: null,
        notes: null,
        section_label: item.section_label,
        superset_group: null,
        exercise: null,
        created_at: item.created_at,
      });
    }
    list.push(item);
    itemsBySession.set(item.session_id, list);
  }

  const sessionsByTemplate = new Map<string, typeof sessions>();
  for (const session of sessions || []) {
    const list = sessionsByTemplate.get(session.template_id) || [];
    list.push({
      ...session,
      items: itemsBySession.get(session.id) || [],
    });
    sessionsByTemplate.set(session.template_id, list);
  }

  const assembled = templates.map((template) => ({
    ...template,
    sessions: sessionsByTemplate.get(template.id) || [],
  }));

  return NextResponse.json({ templates: assembled });
}

// POST: Create or update a template (upsert)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { template } = body;

  if (!template) return NextResponse.json({ error: "template is required" }, { status: 400 });
  const validationError = validateTemplate(template);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const now = new Date().toISOString();

  const templatePayload = {
    name: template.name.trim(),
    description: template.description?.trim() || null,
    overview: template.overview?.trim() || null,
    tags: template.tags || [],
    category: template.category || "general",
    is_active: true,
    updated_at: now,
  };

  const isUpdate = !!template.id;
  let previousSessionIds: string[] = [];
  if (isUpdate) {
    const { data: current, error: currentError } = await admin.from("exercise_training_templates").select("id").eq("id", template.id).maybeSingle();
    if (currentError || !current) return dbError(currentError, "Training template no longer exists. Reload and try again.", 404);
    const { data: previous, error: previousError } = await admin.from("exercise_training_sessions").select("id").eq("template_id", template.id);
    if (previousError) return dbError(previousError, "Couldn't load the existing sessions. Try again.");
    previousSessionIds = (previous || []).map((session) => session.id);
  }

  const { data: created, error: createError } = isUpdate
    ? { data: { id: template.id }, error: null }
    : await admin.from("exercise_training_templates").insert(templatePayload).select("id").maybeSingle();
  if (createError || !created) return dbError(createError, "Couldn't create that training template. Try again.");
  const templateId = created.id;
  const stagedSessionIds: string[] = [];

  async function fail(error: unknown, message: string) {
    const cleanup = isUpdate
      ? stagedSessionIds.length ? await admin.from("exercise_training_sessions").delete().in("id", stagedSessionIds) : { error: null }
      : await admin.from("exercise_training_templates").delete().eq("id", templateId);
    if (cleanup.error) console.error("Couldn't clean up incomplete training template save", cleanup.error);
    return dbError(error, message);
  }

  // Stage replacement sessions while the existing version remains available.
  for (const session of template.sessions) {
    const { data: newSession, error: sError } = await admin
      .from("exercise_training_sessions")
      .insert({
        template_id: templateId,
        name: session.name,
        day_number: session.day_number,
        notes: session.notes || null,
      })
      .select()
      .maybeSingle();

    if (sError || !newSession) return fail(sError, `Couldn't save session "${session.name}". The template was not changed.`);
    stagedSessionIds.push(newSession.id);
    const rows = exerciseRows(session.items, newSession.id);
    if (rows.length) {
      const { error: itemsError } = await admin.from("exercise_training_session_items").insert(rows);
      if (itemsError) return fail(itemsError, `Couldn't save exercises in "${session.name}". The template was not changed.`);
    }
  }

  if (isUpdate) {
    const { data: updated, error: updateError } = await admin.from("exercise_training_templates").update(templatePayload).eq("id", templateId).select("id").maybeSingle();
    if (updateError || !updated) return fail(updateError, "Couldn't update the template details. The old sessions are still available.");
    if (previousSessionIds.length) {
      const { error: deleteError } = await admin.from("exercise_training_sessions").delete().in("id", previousSessionIds);
      if (deleteError) return fail(deleteError, "Couldn't replace the old sessions. Try again.");
    }
  }

  return NextResponse.json({ success: true, template_id: templateId });
}

// DELETE: Soft-delete (set is_active = false)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();

  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin
    .from("exercise_training_templates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", body.id);

  if (error) return dbError(error, "Couldn't delete that training template. Try again.");
  return NextResponse.json({ success: true });
}
