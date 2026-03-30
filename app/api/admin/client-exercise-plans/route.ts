import { requireAdmin } from "@/lib/admin-auth";
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
        .select("*, exercise:exercises(id, name, muscle_group, equipment, description)")
        .in("session_id", sessionIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble nested structure
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
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
      .single();

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
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

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
        .single();

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
            rest_seconds: item.rest_seconds,
            tempo: item.tempo,
            notes: item.notes,
          }))
        );
      }
    }

    return NextResponse.json({ success: true, plan_id: newPlan.id });
  }

  // If plan object provided, save/update a client plan directly (for edits)
  if (plan && plan.client_id) {
    // Archive existing active plans if creating new
    if (!plan.id) {
      await admin
        .from("client_exercise_plans")
        .update({ status: "archived" })
        .eq("client_id", plan.client_id)
        .eq("status", "active");
    }

    // Upsert plan
    const { data: savedPlan, error: planError } = await admin
      .from("client_exercise_plans")
      .upsert({
        id: plan.id || undefined,
        client_id: plan.client_id,
        template_id: plan.template_id || null,
        name: plan.name,
        description: plan.description || null,
        status: plan.status || "active",
        start_date: plan.start_date || new Date().toISOString().split("T")[0],
        end_date: plan.end_date || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

    // Delete existing sessions (cascade deletes items)
    if (plan.id) {
      await admin.from("client_exercise_sessions").delete().eq("plan_id", savedPlan.id);
    }

    // Insert sessions and items
    for (const session of plan.sessions || []) {
      const { data: newSession } = await admin
        .from("client_exercise_sessions")
        .insert({
          plan_id: savedPlan.id,
          name: session.name,
          day_number: session.day_number,
          notes: session.notes || null,
        })
        .select()
        .single();

      if (!newSession) continue;

      const sessionItems = session.items || [];
      if (sessionItems.length > 0) {
        await admin.from("client_exercise_session_items").insert(
          sessionItems.map((item: { exercise_id: string; order_index: number; sets: number; reps: string; rest_seconds?: number; tempo?: string; notes?: string }) => ({
            session_id: newSession.id,
            exercise_id: item.exercise_id,
            order_index: item.order_index,
            sets: item.sets,
            reps: item.reps,
            rest_seconds: item.rest_seconds || null,
            tempo: item.tempo || null,
            notes: item.notes || null,
          }))
        );
      }
    }

    return NextResponse.json({ success: true, plan_id: savedPlan.id });
  }

  return NextResponse.json({ error: "Provide template_id + client_id, or a plan object" }, { status: 400 });
}

// PATCH: Update plan status
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) return NextResponse.json({ error: "id and status are required" }, { status: 400 });

  const { error } = await admin
    .from("client_exercise_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
