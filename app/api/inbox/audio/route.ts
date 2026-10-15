import { getInboxAudioPlayback, inboxAudioPlaybackUrl } from "@/lib/inbox-audio-playback";
import { ALLOWED_AUDIO_TYPES as ALLOWED_TYPES, hasExpectedAudioSignature } from "@/lib/audio-file";
import { getInboxViewer } from "@/lib/inbox-server";
import { notifyClientUser } from "@/lib/client-notifications";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SECONDS = 180;

export async function POST(request: Request) {
  const viewer = await getInboxViewer();
  if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const limited = rateLimit(`inbox-audio:${viewer.userId}`, viewer.role === "admin" ? 30 : 12, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many voice notes. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)) },
    });
  }
  const form = await request.formData();
  const file = form.get("audio") as File | null;
  const requestedClientId = String(form.get("client_id") || "");
  const duration = Math.round(Number(form.get("duration_seconds")));
  const contentType = file?.type?.split(";")[0] || "";
  if (!file || !ALLOWED_TYPES.has(contentType)) return NextResponse.json({ error: "Unsupported voice note format" }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Voice notes must be under 15MB" }, { status: 400 });
  if (!Number.isFinite(duration) || duration < 1 || duration > MAX_SECONDS) return NextResponse.json({ error: "Voice notes can be up to 3 minutes" }, { status: 400 });

  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : requestedClientId;
  if (!clientId) return NextResponse.json({ error: "Client is required" }, { status: 400 });
  const { data: profile } = await admin.from("client_profiles").select("id, user_id, business_name").eq("id", clientId).maybeSingle();
  if (!profile || (viewer.role === "client" && profile.id !== viewer.clientProfileId)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedAudioSignature(contentType, signature)) {
    return NextResponse.json({ error: "That recording file is not valid audio" }, { status: 400 });
  }
  const audioBuffer = await file.arrayBuffer();

  const extension = ALLOWED_TYPES.get(contentType)!;
  const path = `${profile.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("inbox-audio").upload(path, audioBuffer, { contentType, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Voice note upload failed" }, { status: 500 });

  const { data: row, error } = await admin.from("inbox_messages").insert({
    client_id: profile.id,
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: "",
    message_type: "audio",
    audio_bucket: "inbox-audio",
    audio_path: path,
    audio_mime_type: contentType,
    audio_size_bytes: file.size,
    audio_duration_seconds: duration,
    read_by_admin: viewer.role === "admin",
    read_by_client: viewer.role === "client",
  }).select("*").single();
  if (error) {
    await admin.storage.from("inbox-audio").remove([path]);
    return NextResponse.json({ error: "Voice note could not be saved" }, { status: 500 });
  }

  if (viewer.role === "admin") {
    await notifyClientUser(profile.user_id, { title: "New voice note from Gordy", message: "Tap to listen", link: "/portal/inbox", tag: `inbox-${profile.id}` });
  } else {
    const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
    const title = `New voice note from ${profile.business_name || viewer.fullName || "a client"}`;
    await Promise.all((admins || []).map(async (adminUser) => {
      await admin.from("notifications").insert({ user_id: adminUser.id, title, message: "Tap to listen", link: `/admin/inbox?client=${profile.id}`, tag: `inbox-${profile.id}` });
      await sendPushToUser(adminUser.id, { title, body: "Tap to listen", url: `/admin/inbox?client=${profile.id}`, tag: `inbox-${profile.id}` }, { lifecycleVerified: true });
    }));
  }

  return NextResponse.json({ message: { ...row, audio_url: inboxAudioPlaybackUrl(row.id) } });
}

// A stable authenticated URL keeps inbox polling from resetting an active player.
// Redirect on each media request so byte-range requests can obtain a fresh token.
export async function GET(request: Request) {
  const viewer = await getInboxViewer();
  if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return getInboxAudioPlayback(request, viewer, createAdminClient());
}
