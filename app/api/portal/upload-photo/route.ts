import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const VALID_ANGLES = new Set(["front", "back", "side"]);
const ALLOWED_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

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

  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo is too large. Maximum 12MB." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (!VALID_ANGLES.has(angle)) {
    return NextResponse.json({ error: "angle must be front, back, or side" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  if (!ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File extension not allowed: ${ext}` }, { status: 400 });
  }

  const path = `${profile.id}/${date}/${angle}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from("progress-photos")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
