import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const ALLOWED_AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);

async function checkAvatarBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: bucket, error: getError } = await admin.storage.getBucket("avatars");
  if (getError || !bucket) {
    return "Avatar storage is not configured.";
  }
  if (!bucket.public) {
    return "Avatar storage is not public.";
  }
  return null;
}

function bytesStartWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function hasImageSignature(bytes: Uint8Array, ext: string, mimeType: string) {
  const normalizedExt = ext === "jpeg" ? "jpg" : ext;
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedExt === "jpg" && normalizedMime === "image/jpeg") {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (normalizedExt === "png" && normalizedMime === "image/png") {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (normalizedExt === "gif" && normalizedMime === "image/gif") {
    return ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a";
  }
  if (normalizedExt === "webp" && normalizedMime === "image/webp") {
    return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  }
  if ((normalizedExt === "heic" || normalizedExt === "heif") && (normalizedMime === "image/heic" || normalizedMime === "image/heif")) {
    const brand = ascii(bytes, 8, 4);
    const compatibleBrands = ascii(bytes, 8, Math.min(bytes.length - 8, 48));
    return ascii(bytes, 4, 4) === "ftyp" && ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].some((item) =>
      brand === item || compatibleBrands.includes(item)
    );
  }

  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const userId = user.id;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // iPhone camera-roll photos are often larger than old desktop avatar limits.
  // Keep a sane cap, but don't reject normal phone photos before upload.
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mimeType = file.type.toLowerCase();
  const hasAllowedType = ALLOWED_AVATAR_TYPES.has(mimeType);
  const hasAllowedExtension = ALLOWED_AVATAR_EXTENSIONS.has(ext);

  if (!hasAllowedType || !hasAllowedExtension) {
    return NextResponse.json({ error: `File type not allowed: ${file.type || ext || "unknown"}` }, { status: 400 });
  }

  const safeExt = ext;
  const filePath = `${userId}/avatar-${Date.now()}.${safeExt}`;

  const bucketError = await checkAvatarBucket(admin);
  if (bucketError) {
    return NextResponse.json({ error: bucketError }, { status: 500 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  if (!hasImageSignature(body, safeExt, mimeType)) {
    return NextResponse.json({ error: "File content does not match an allowed image type." }, { status: 400 });
  }

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(filePath, body, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(filePath);
  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update user record
  const { data: updatedUser, error: updateError } = await admin
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("avatar_url")
    .single();

  if (updateError || !updatedUser?.avatar_url) {
    await admin.storage.from("avatars").remove([filePath]);
    return NextResponse.json(
      { error: updateError?.message || "Avatar uploaded, but profile update failed." },
      { status: 500 }
    );
  }

  const { data: existingFiles } = await admin.storage.from("avatars").list(userId);
  const oldPaths = (existingFiles || [])
    .map((item) => `${userId}/${item.name}`)
    .filter((path) => path !== filePath);
  if (oldPaths.length > 0) {
    await admin.storage.from("avatars").remove(oldPaths);
  }

  return NextResponse.json({ avatarUrl: updatedUser.avatar_url });
}
