import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { data, error } = await admin
    .from("client_tasks")
    .select("*")
    .eq("client_id", profile.id)
    .order("completed", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const body = await request.json();
  const taskText = body?.task_text?.trim();

  if (!taskText) return NextResponse.json({ error: "task_text is required" }, { status: 400 });
  if (taskText.length > 500) return NextResponse.json({ error: "task_text must be under 500 characters" }, { status: 400 });

  const { data, error } = await admin
    .from("client_tasks")
    .insert({ client_id: profile.id, task_text: taskText, source: "client" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const body = await request.json();
  const { id, completed } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof completed !== "boolean") return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 });

  // Verify task belongs to this client
  const { data: existing } = await admin
    .from("client_tasks")
    .select("id")
    .eq("id", id)
    .eq("client_id", profile.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data, error } = await admin
    .from("client_tasks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}
