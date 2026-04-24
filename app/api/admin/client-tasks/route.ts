import { requireAdmin } from "@/lib/admin-auth";
import { notifyClientProfile } from "@/lib/client-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { client_id, task_text } = body;

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });
  if (!task_text || !task_text.trim()) return NextResponse.json({ error: "task_text is required" }, { status: 400 });
  if (task_text.trim().length > 500) return NextResponse.json({ error: "task_text must be under 500 characters" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_tasks")
    .insert({ client_id, task_text: task_text.trim(), source: "coach" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyClientProfile(client_id, {
    title: "New task from Gordy",
    message: task_text.trim().slice(0, 160),
    link: "/portal",
    tag: `client-task-${data.id}`,
  });

  return NextResponse.json({ task: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_tasks")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
