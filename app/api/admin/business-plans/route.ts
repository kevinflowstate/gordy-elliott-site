import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getClients, savePlan, completePlan } from "@/lib/admin-data";
import { validateBusinessPlan } from "@/lib/business-plans";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clients = await getClients();

  const plans = clients.flatMap(client =>
    client.training_plan.map(plan => ({
      ...plan,
      client_name: client.name,
      client_id_profile: client.id,
      client_business: client.business_name,
      client_status: client.status,
      programme_type: client.programme_type,
    }))
  );

  const clientsWithoutPlan = clients
    .filter(c => !c.training_plan.some(p => p.status === "active"))
    .map(c => ({ id: c.id, name: c.name, business_name: c.business_name, programme_type: c.programme_type, status: c.status }));

  const allClients = clients.map(c => ({ id: c.id, name: c.name, business_name: c.business_name, programme_type: c.programme_type }));

  return NextResponse.json({ plans, clientsWithoutPlan, allClients });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body"); } catch { return NextResponse.json({error: "Invalid JSON"}, {status:400}); }

  if (body.action === "update_item") {
    if (typeof body.item_id !== "string" || typeof body.client_id !== "string" || (body.completed !== undefined && typeof body.completed !== "boolean") || (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 20000))) return NextResponse.json({error:"Invalid action update"}, {status:400});
    const {data,error} = await createAdminClient().rpc("update_business_plan_item", {payload:{item_id:body.item_id,client_id:body.client_id,...(body.completed !== undefined ? {completed:body.completed} : {}),...(body.notes !== undefined ? {notes:body.notes} : {})}});
    if (error) return NextResponse.json({error:"Could not update action"}, {status:500});
    return NextResponse.json({success:true,item:data});
  }
  // If action is "complete", mark a plan as completed
  if (body.action === "complete" && body.plan_id) {
    const result = await completePlan(body.plan_id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Otherwise, save/update a full plan
  if (!body.plan) {
    return NextResponse.json({ error: "plan is required" }, { status: 400 });
  }

  try { validateBusinessPlan(body.plan); } catch (error) { return NextResponse.json({error: error instanceof Error ? error.message : "Invalid plan"}, {status:400}); }
  const result = await savePlan(body.plan);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
