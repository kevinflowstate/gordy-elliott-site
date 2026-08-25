import { getInboxViewer } from "@/lib/inbox-server";
import { notifyClientUser } from "@/lib/client-notifications";
import { sendPushToUser } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 12000;
const ALLOWED_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"]]);

function readImageSize(contentType: string, bytes: Uint8Array): { width: number; height: number } | null {
  if (contentType === "image/png") {
    const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || !expected.every((value, index) => bytes[index] === value)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (contentType !== "image/jpeg" || bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += length + 2;
  }
  return null;
}

export async function POST(request: Request) {
  const viewer = await getInboxViewer();
  if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const limited = rateLimit(`inbox-image:${viewer.userId}`, viewer.role === "admin" ? 40 : 15, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many photos. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)) },
    });
  }

  const form = await request.formData();
  const file = form.get("image") as File | null;
  const requestedClientId = String(form.get("client_id") || "");
  const contentType = file?.type?.toLowerCase() || "";
  if (!file || !ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported photo format. Choose a JPEG or PNG photo." }, { status: 400 });
  }
  if (file.size < 1 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photos must be under 10MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : requestedClientId;
  if (!clientId) return NextResponse.json({ error: "Client is required" }, { status: 400 });
  const { data: profile } = await admin.from("client_profiles").select("id, user_id, business_name").eq("id", clientId).maybeSingle();
  if (!profile || (viewer.role === "client" && profile.id !== viewer.clientProfileId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = readImageSize(contentType, bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    return NextResponse.json({ error: "That file is not a valid photo." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(contentType)!;
  const path = `${profile.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("inbox-images").upload(path, bytes, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "Photo upload failed." }, { status: 500 });

  const { data: row, error } = await admin.from("inbox_messages").insert({
    client_id: profile.id,
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: "",
    message_type: "image",
    image_bucket: "inbox-images",
    image_path: path,
    image_mime_type: contentType,
    image_size_bytes: file.size,
    image_width: dimensions.width,
    image_height: dimensions.height,
    read_by_admin: viewer.role === "admin",
    read_by_client: viewer.role === "client",
  }).select("*").single();
  if (error) {
    await admin.storage.from("inbox-images").remove([path]);
    return NextResponse.json({ error: "Photo could not be saved." }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from("inbox-images").createSignedUrl(path, 60 * 10);
  if (viewer.role === "admin") {
    await notifyClientUser(profile.user_id, { title: "New photo from Gordy", message: "Tap to view", link: "/portal/inbox", tag: `inbox-${profile.id}` });
  } else {
    const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
    const title = `New photo from ${profile.business_name || viewer.fullName || "a client"}`;
    await Promise.all((admins || []).map(async (adminUser) => {
      await admin.from("notifications").insert({ user_id: adminUser.id, title, message: "Tap to view", link: `/admin/inbox?client=${profile.id}`, tag: `inbox-${profile.id}` });
      await sendPushToUser(adminUser.id, { title, body: "Tap to view", url: `/admin/inbox?client=${profile.id}`, tag: `inbox-${profile.id}` }, { lifecycleVerified: true });
    }));
  }

  return NextResponse.json(
    { message: { ...row, image_url: signed?.signedUrl || null } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
