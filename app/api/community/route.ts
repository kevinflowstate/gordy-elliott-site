import { getCommunityViewer, listShiftCommunityMessages, notifyCommunityPost } from "@/lib/community-server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: "SHIFT community access is required" }, { status: 403 });
  try {
    const messages = await listShiftCommunityMessages();
    return NextResponse.json({ viewerUserId: viewer.userId, role: viewer.role, messages }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The SHIFT community could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const viewer = await getCommunityViewer();
  if (!viewer) return NextResponse.json({ error: "SHIFT community access is required" }, { status: 403 });

  const limited = rateLimit(`shift-community-text:${viewer.userId}`, viewer.role === "admin" ? 80 : 30, 15 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many messages. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((limited.resetAt - Date.now()) / 1000)) },
    });
  }

  const { message } = await request.json().catch(() => ({}));
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (!trimmed || trimmed.length > 4000) {
    return NextResponse.json({ error: "Enter a message up to 4,000 characters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin.from("shift_community_messages").insert({
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: trimmed,
    message_type: "text",
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Message could not be saved" }, { status: 500 });

  await notifyCommunityPost(viewer, "text", trimmed);
  return NextResponse.json({ message: { ...row, client_id: "shift-community", sender_name: viewer.role === "admin" ? "Gordy" : viewer.fullName } });
}
