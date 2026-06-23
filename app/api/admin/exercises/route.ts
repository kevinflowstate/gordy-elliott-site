import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const muscle_group = searchParams.get("muscle_group");
  const equipment = searchParams.get("equipment");
  const search = searchParams.get("search");

  let query = admin.from("exercises").select("*").eq("is_active", true).order("name");
  if (muscle_group) query = query.eq("muscle_group", muscle_group);
  if (equipment) query = query.eq("equipment", equipment);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const exercises = data || [];
  const terms = search ? normalizeSearch(search).split(" ").filter(Boolean) : [];
  if (terms.length === 0) return NextResponse.json({ exercises });

  return NextResponse.json({
    exercises: exercises.filter((exercise) => {
      const haystack = normalizeSearch([
        exercise.name,
        exercise.description,
        exercise.muscle_group,
        exercise.equipment,
      ].filter(Boolean).join(" "));
      return terms.every((term) => haystack.includes(term));
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const muscleGroup = typeof body.muscle_group === "string" ? body.muscle_group.trim() : "";

  if (!name || !muscleGroup) {
    return NextResponse.json({ error: "Name and muscle group are required" }, { status: 400 });
  }

  const { data, error } = await admin.from("exercises").insert({
    name,
    muscle_group: muscleGroup,
    equipment: typeof body.equipment === "string" && body.equipment.trim() ? body.equipment.trim() : "bodyweight",
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    video_url: typeof body.video_url === "string" && body.video_url.trim() ? body.video_url.trim() : null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exercise: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data, error } = await admin.from("exercises").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exercise: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin.from("exercises").update({ is_active: false }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
