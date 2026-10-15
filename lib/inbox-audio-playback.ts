import type { InboxViewer } from "@/lib/inbox-server";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export function inboxAudioPlaybackUrl(messageId: string) {
  return `/api/inbox/audio?message=${encodeURIComponent(messageId)}`;
}

export async function getInboxAudioPlayback(request: Request, viewer: InboxViewer, admin: AdminClient) {
  const messageId = new URL(request.url).searchParams.get("message") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(messageId)) {
    return Response.json({ error: "Invalid voice note" }, { status: 400 });
  }
  if (viewer.role !== "admin" && (viewer.role !== "client" || !viewer.clientProfileId)) {
    return Response.json({ error: "Voice note unavailable" }, { status: 404 });
  }

  let query = admin.from("inbox_messages")
    .select("client_id, audio_bucket, audio_path")
    .eq("id", messageId).eq("message_type", "audio");
  if (viewer.role === "client") query = query.eq("client_id", viewer.clientProfileId!);
  const { data: message, error } = await query.maybeSingle();
  if (error) return Response.json({ error: "Voice note could not be loaded" }, { status: 500 });
  if (!message?.audio_path || message.audio_bucket !== "inbox-audio") {
    return Response.json({ error: "Voice note unavailable" }, { status: 404 });
  }

  const { data: signed, error: signingError } = await admin.storage
    .from("inbox-audio").createSignedUrl(message.audio_path, 60 * 10);
  if (signingError || !signed?.signedUrl) {
    return Response.json({ error: "Voice note could not be loaded" }, { status: 500 });
  }
  // 307 preserves the player's Range header; storage serves the original audio inline.
  return new Response(null, { status: 307, headers: {
    Location: signed.signedUrl,
    "Cache-Control": "private, no-store",
  } });
}
