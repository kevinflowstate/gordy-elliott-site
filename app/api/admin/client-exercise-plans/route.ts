import { createExerciseSectionDivider } from "@/lib/exercise-section";
import { exerciseRows, validateTemplate } from "@/lib/exercise-plan-save";
import type { ExerciseTemplate, ExerciseSession } from "@/lib/types";
import { requireAdmin } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-errors";
import { notifyClientProfile } from "@/lib/client-notifications";
import { normalisePrescriptionType } from "@/lib/exercise-prescriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch a client's exercise plans
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  // Fetch plans
  const { data: plans, error } = await admin
    .from("client_exercise_plans")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return dbError(error, "Couldn't load exercise plans. Try again.");
  if (!plans || plans.length === 0) return NextResponse.json({ plans: [] });

  const planIds = plans.map((p) => p.id);

  // Fetch sessions
  const { data: sessions } = await admin
    .from("client_exercise_sessions")
    .select("*")
    .in("plan_id", planIds)
    .order("day_number", { ascending: true });

  const sessionIds = (sessions || []).map((s) => s.id);

  // Fetch items joined with exercises
  const { data: items } = sessionIds.length
    ? await admin
        .from("client_exercise_session_items")
        .select("*, exercise:exercises(id, name, muscle_group, equipment, description, video_url)")
        .in("session_id", sessionIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble nested structure (reconstruct section dividers from section_label)
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
    if (item.section_label) {
      list.push(createExerciseSectionDivider(item));
    }
    list.push(item);
    itemsBySession.set(item.session_id, list);
  }

  const sessionsByPlan = new Map<string, typeof sessions>();
  for (const session of sessions || []) {
    const list = sessionsByPlan.get(session.plan_id) || [];
    list.push({
      ...session,
      items: itemsBySession.get(session.id) || [],
    });
    sessionsByPlan.set(session.plan_id, list);
  }

  const assembled = plans.map((plan) => ({
    ...plan,
    sessions: sessionsByPlan.get(plan.id) || [],
  }));

  return NextResponse.json({ plans: assembled });
}

// POST: Assign a template to a client (deep copy) or save a plan from scratch
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();

  const { client_id, template_id, plan } = body;

  // If template_id provided, deep-copy the template
  if (template_id && client_id) {
    // Fetch template
    const { data: template } = await admin
      .from("exercise_training_templates")
      .select("*")
      .eq("id", template_id)
      .maybeSingle();

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Fetch template sessions
    const { data: sessions } = await admin
      .from("exercise_training_sessions")
      .select("*")
      .eq("template_id", template_id)
      .order("day_number", { ascending: true });

    const sessionIds = (sessions || []).map((s) => s.id);

    // Fetch template items
    const { data: items } = sessionIds.length
      ? await admin
          .from("exercise_training_session_items")
          .select("*")
          .in("session_id", sessionIds)
          .order("order_index", { ascending: true })
      : { data: [] };

    // Archive any existing active plans for this client
    await admin
      .from("client_exercise_plans")
      .update({ status: "archived" })
      .eq("client_id", client_id)
      .eq("status", "active");

    // Create client plan
    const { data: newPlan, error: planError } = await admin
      .from("client_exercise_plans")
      .insert({
        client_id,
        template_id,
        name: template.name,
        description: template.description,
        overview: template.overview || null,
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .maybeSingle();

    if (planError || !newPlan) return dbError(planError, "Couldn't assign that training plan. Try again.");

    // Deep copy sessions and items
    const itemsBySession = new Map<string, typeof items>();
    for (const item of items || []) {
      const list = itemsBySession.get(item.session_id) || [];
      list.push(item);
      itemsBySession.set(item.session_id, list);
    }

    for (const session of sessions || []) {
      const { data: newSession } = await admin
        .from("client_exercise_sessions")
        .insert({
          plan_id: newPlan.id,
          name: session.name,
          day_number: session.day_number,
          notes: session.notes,
        })
        .select()
        .maybeSingle();

      if (!newSession) continue;

      const sessionItems = itemsBySession.get(session.id) || [];
      if (sessionItems.length > 0) {
        await admin.from("client_exercise_session_items").insert(
          sessionItems.map((item) => ({
            session_id: newSession.id,
            exercise_id: item.exercise_id,
            order_index: item.order_index,
            sets: item.sets,
            reps: item.reps,
            prescription_type: normalisePrescriptionType(item.prescription_type),
            prescription_text: item.prescription_text || null,
            rest_seconds: item.rest_seconds,
            tempo: item.tempo,
            notes: item.notes,
            section_label: item.section_label,
            superset_group: item.superset_group,
          }))
        );
      }
    }

    const notification = await notifyClientProfile(client_id, {
      title: "Training plan updated",
      message: "Gordy updated your training plan. Open it before your next session.",
      link: "/portal/exercise-plan",
      tag: `training-plan-${newPlan.id}`,
    });

    return NextResponse.json({ success: true, plan_id: newPlan.id, notification });
  }

  // If plan object provided, save/update a client plan directly (for edits)
  if (plan && plan.client_id) {
    const validationError = validateTemplate(plan as ExerciseTemplate);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const payload = {
      ...plan,
      sessions: (plan.sessions as ExerciseSession[]).map((session) => ({
        id: session.id || null,
        name: session.name.trim(),
        day_number: session.day_number,
        notes: session.notes || null,
        items: exerciseRows(session.items, "", true),
      })),
    };
    const { data: planId, error: saveError } = await admin.rpc("save_client_exercise_plan", {
      p_plan: payload,
    });
    if (saveError || !planId) {
      const safeErrors = ["Reload this plan", "Logged exercises", "Logged sessions", "Existing exercises"];
      const safeMessage = safeErrors.some((prefix) => saveError?.message?.startsWith(prefix))
        ? saveError!.message : "Couldn't save this training plan. Nothing was changed. Try again.";
      return dbError(saveError, safeMessage);
    }
    const savedPlan = { id: planId as string };

    const notification = await notifyClientProfile(plan.client_id, {
      title: "Training plan updated",
      message: "Gordy updated your training plan. Open it before your next session.",
      link: "/portal/exercise-plan",
      tag: `training-plan-${savedPlan.id}`,
    });

    return NextResponse.json({ success: true, plan_id: savedPlan.id, notification });
  }

  return NextResponse.json({ error: "Provide template_id + client_id, or a plan object" }, { status: 400 });
}

// PATCH: Metadata/status changes do not replace sessions or exercise history.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = createAdminClient();
  const body = await request.json();
  const { id, status, description } = body;
  if (!id || (status === undefined && description === undefined)) {
    return NextResponse.json({ error: "id and status or description are required" }, { status: 400 });
  }
  if ((status !== undefined && !["active", "completed", "archived"].includes(status))
    || (description !== undefined && description !== null && typeof description !== "string")) {
    return NextResponse.json({ error: "Invalid plan status or description" }, { status: 400 });
  }
  const { data: existingPlan, error: readError } = await admin.from("client_exercise_plans")
    .select("client_id,status").eq("id", id).maybeSingle();
  if (readError) return dbError(readError, "Couldn't load that training plan.");
  if (!existingPlan) return NextResponse.json({ error: "Training plan not found" }, { status: 404 });
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) changes.status = status;
  if (description !== undefined) changes.description = description?.trim() || null;
  const { error } = await admin.from("client_exercise_plans").update(changes).eq("id", id);
  if (error) return dbError(error, "Couldn't update that training plan. Try again.");
  if (status === "active" && existingPlan.status !== "active") {
    await notifyClientProfile(existingPlan.client_id, {
      title: "Training plan updated", message: "Gordy made a training plan active for you.",
      link: "/portal/exercise-plan", tag: `training-plan-${id}`,
    });
  }
  return NextResponse.json({ success: true });
}
