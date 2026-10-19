import { loadTemplateRows, TEMPLATE_LOAD_VERSION } from "@/lib/exercise-template-load";
import { createExerciseSectionDivider } from "@/lib/exercise-section";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { exerciseRows, validateTemplate } from "@/lib/exercise-plan-save";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { ExerciseTemplate, ExerciseSession, ExerciseSessionItem } from "@/lib/types";

// GET: Fetch all active templates with nested sessions and items
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  const { data: templates, error: tError } = await loadTemplateRows<ExerciseTemplate>(admin, "exercise_training_templates", "*");
  if (tError || !templates) return dbError(tError, "Couldn't load training templates. Try again.");
  if (!templates.length) return NextResponse.json({ templates: [] });
  templates.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const { data: sessions, error: sError } = await loadTemplateRows<ExerciseSession & { template_id: string }>(admin, "exercise_training_sessions", "*", {
    column: "template_id", ids: templates.map((t) => t.id),
  });
  if (sError || !sessions) return dbError(sError, "Couldn't load all template sessions. Please reload before editing.");
  sessions.sort((a, b) => a.day_number - b.day_number || a.id.localeCompare(b.id));

  const { data: items, error: iError } = await loadTemplateRows<ExerciseSessionItem>(admin, "exercise_training_session_items",
    "*, exercise:exercises(id, name, muscle_group, equipment, description)", {
      column: "session_id", ids: sessions.map((s) => s.id),
    });
  if (iError || !items) return dbError(iError, "Couldn't load all template exercises. Please reload before editing.");
  items.sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));

  // Assemble nested structure using Maps
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
    // If this item has a section_label, insert a section divider before it
    if (item.section_label) {
      list.push(createExerciseSectionDivider({ ...item, section_label: item.section_label }) as unknown as ExerciseSessionItem);
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
    load_version: TEMPLATE_LOAD_VERSION,
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
  if (template.id && template.load_version !== TEMPLATE_LOAD_VERSION) {
    return NextResponse.json({ error: "This editor was opened before the full-plan loading update. Close it and refresh the page before editing. Nothing was changed." }, { status: 409 });
  }
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
