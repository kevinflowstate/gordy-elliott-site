import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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

  if (tError) return NextResponse.json({ error: tError.message }, { status: 500 });
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
  if (!template.name?.trim()) return NextResponse.json({ error: "template.name is required" }, { status: 400 });

  const now = new Date().toISOString();

  // Upsert the template row
  const { data: savedTemplate, error: tError } = await admin
    .from("exercise_training_templates")
    .upsert({
      id: template.id || undefined,
      name: template.name.trim(),
      description: template.description?.trim() || null,
      category: template.category || "general",
      duration_weeks: template.duration_weeks || null,
      is_active: true,
      updated_at: now,
    })
    .select()
    .single();

  if (tError) return NextResponse.json({ error: tError.message }, { status: 500 });

  // Delete existing sessions for this template (cascade deletes items via FK)
  await admin.from("exercise_training_sessions").delete().eq("template_id", savedTemplate.id);

  // Insert new sessions and items
  for (const session of template.sessions || []) {
    const { data: newSession, error: sError } = await admin
      .from("exercise_training_sessions")
      .insert({
        template_id: savedTemplate.id,
        name: session.name,
        day_number: session.day_number,
        notes: session.notes || null,
      })
      .select()
      .single();

    if (sError || !newSession) continue;

    const sessionItems = session.items || [];
    // Split into real exercises and section dividers
    const exerciseItems = sessionItems.filter(
      (item: { exercise_id: string }) => item.exercise_id && item.exercise_id !== "__section__"
    );
    const sectionItems = sessionItems.filter(
      (item: { exercise_id: string }) => !item.exercise_id || item.exercise_id === "__section__"
    );

    // Insert real exercise items
    if (exerciseItems.length > 0) {
      await admin.from("exercise_training_session_items").insert(
        exerciseItems.map(
          (item: {
            exercise_id: string;
            order_index: number;
            sets: number;
            reps: string;
            rest_seconds?: number;
            tempo?: string;
            notes?: string;
            section_label?: string;
            superset_group?: string;
          }) => ({
            session_id: newSession.id,
            exercise_id: item.exercise_id,
            order_index: item.order_index,
            sets: item.sets,
            reps: item.reps,
            rest_seconds: item.rest_seconds || null,
            tempo: item.tempo || null,
            notes: item.notes || null,
            section_label: item.section_label || null,
            superset_group: item.superset_group || null,
          })
        )
      );
    }

    // For section dividers, store as items with a placeholder exercise_id
    // We need to handle these client-side only since DB requires exercise_id FK
    // Instead, attach section_label to the next real exercise in order
    for (const section of sectionItems) {
      const sIdx = (section as { order_index: number }).order_index;
      // Find next real exercise after this section divider
      const nextExercise = exerciseItems.find(
        (e: { order_index: number }) => e.order_index > sIdx
      );
      if (nextExercise) {
        await admin
          .from("exercise_training_session_items")
          .update({ section_label: (section as { section_label?: string }).section_label || "Section" })
          .eq("session_id", newSession.id)
          .eq("exercise_id", (nextExercise as { exercise_id: string }).exercise_id)
          .eq("order_index", (nextExercise as { order_index: number }).order_index);
      }
    }
  }

  return NextResponse.json({ success: true, template_id: savedTemplate.id });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
