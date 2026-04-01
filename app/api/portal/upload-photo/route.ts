import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const angle = formData.get("angle") as string | null;
  const date = formData.get("date") as string | null;

  if (!file || !angle || !date) {
    return NextResponse.json({ error: "file, angle, and date are required" }, { status: 400 });
  }

  const validAngles = ["front", "back", "side"];
  if (!validAngles.includes(angle)) {
    return NextResponse.json({ error: "angle must be front, back, or side" }, { status: 400 });
  }

  const path = `${profile.id}/${date}/${angle}.jpg`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from("progress-photos")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
