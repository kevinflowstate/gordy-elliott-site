import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { notifyClientUser } from "@/lib/client-notifications";
import { sendCheckinReplyEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().then((value) => value && typeof value === "object" ? value : {}).catch(() => ({}));
  const reply = typeof body.reply_text === "string" ? body.reply_text.trim() : "";
  if (typeof body.checkin_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.checkin_id) || !reply || reply.length > 4000) {
    return NextResponse.json({ error: "A valid check-in and a reply of 1–4000 characters are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("save_checkin_dm_reply", {
    p_admin_id: auth.userId, p_checkin_id: body.checkin_id, p_reply: reply,
  });
  if (error) {
    console.error("Check-in DM save failed:", error.code);
    return NextResponse.json({ error: error.code === "P0002" ? "Check-in not found" : "Couldn't save your check-in reply" }, { status: error.code === "P0002" ? 404 : 500 });
  }
  const saved = data as { message_id: string; client_id: string; created: boolean };
  const link = `/portal/inbox?message=${saved.message_id}`;

  // The transaction owns deduplication. Edits/retries do not send a second alert.
  if (saved.created) {
    try {
      const { data: profile } = await admin.from("client_profiles").select("user_id").eq("id", saved.client_id).single();
      if (profile) {
        const notification = await notifyClientUser(profile.user_id, {
          title: "Gordy replied to your check-in", message: reply.slice(0, 200),
          link, tag: `checkin-reply-${body.checkin_id}`,
        });
        if (!notification.suppressed) {
          const { data: client } = await admin.from("users").select("email, full_name").eq("id", profile.user_id).single();
          if (client) await sendCheckinReplyEmail(client.email, client.full_name, reply, link);
        }
      }
    } catch (err) {
      // A notification failure must not claim the saved reply failed.
      console.error("Check-in reply alert failed:", err instanceof Error ? err.message : "Unknown error");
    }
  }
  return NextResponse.json({ success: true, message_id: saved.message_id, created: saved.created });
}
