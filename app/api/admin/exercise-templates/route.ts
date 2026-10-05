import { createExerciseSectionDivider } from "@/lib/exercise-section";
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
      const needsReps = normalisePrescriptionType(item.prescription_type) === "sets_reps";
      if (!Number.isInteger(item.sets) || item.sets < 0 || (needsReps && !item.reps?.trim())) return `Exercise ${itemIndex + 1} in ${session.name} needs a valid target.`;
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
      list.push(createExerciseSectionDivider(item));
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
  const { template } = body as { template?: ExerciseTemplate };

  if (!template) return NextResponse.json({ error: "template is required" }, { status: 400 });
  const validationError = validateTemplate(template);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const payload = {
    name: template.name.trim(),
    description: template.description?.trim() || null,
    overview: template.overview?.trim() || null,
    tags: template.tags || [],
    category: template.category || "general",
    sessions: template.sessions.map((session) => ({
      name: session.name.trim(),
      day_number: session.day_number,
      notes: session.notes || null,
      items: exerciseRows(session.items, ""),
    })),
  };
  const { data: templateId, error } = await admin.rpc("save_exercise_training_template", {
    p_template_id: template.id || null,
    p_template: payload,
  });
  if (error || !templateId) return dbError(error, "Couldn't save that training template. Nothing was changed. Try again.");
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
