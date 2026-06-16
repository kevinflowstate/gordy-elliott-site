import { getInboxViewer } from "@/lib/inbox-server";
import { notifyClientUser } from "@/lib/client-notifications";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface ClientRecord {
  id: string;
  user_id: string;
  business_name: string | null;
}

interface AdminUser {
  id: string;
}

export async function POST(request: Request) {
  const viewer = await getInboxViewer();
  if (!viewer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { client_id, message } = await request.json().catch(() => ({}));
  const trimmed = typeof message === "string" ? message.trim() : "";

  if (!trimmed) return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (trimmed.length > 4000) return NextResponse.json({ error: "message is too long" }, { status: 400 });

  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : client_id;

  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .eq("id", clientId)
    .maybeSingle<ClientRecord>();

  if (!clientProfile) return NextResponse.json({ error: "Client conversation not found" }, { status: 404 });
  if (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: row, error } = await admin
    .from("inbox_messages")
    .insert({
      client_id: clientProfile.id,
      sender_user_id: viewer.userId,
      sender_role: viewer.role,
      message: trimmed,
      read_by_admin: viewer.role === "admin",
      read_by_client: viewer.role === "client",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const preview = trimmed.slice(0, 200);
  const notification =
    viewer.role === "admin"
      ? await notifyClientUser(clientProfile.user_id, {
          title: "New message from Gordy",
          message: preview,
          link: "/portal/inbox",
          tag: `inbox-${clientProfile.id}`,
        })
      : await notifyAdmins(admin, clientProfile, viewer.fullName, preview);

  return NextResponse.json({ message: row, notification });
}

async function notifyAdmins(
  admin: ReturnType<typeof createAdminClient>,
  clientProfile: ClientRecord,
  senderName: string,
  preview: string,
) {
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .returns<AdminUser[]>();

  const adminIds = (admins ?? []).map((user) => user.id);
  const title = `New message from ${clientProfile.business_name || senderName || "a client"}`;
  const link = `/admin/inbox?client=${clientProfile.id}`;

  if (adminIds.length === 0) {
    return { sent: 0, failed: 0, reason: "No admin users found.", subscriptionCount: 0 };
  }

  await admin.from("notifications").insert(
    adminIds.map((userId) => ({
      user_id: userId,
      title,
      message: preview,
      link,
      tag: `inbox-${clientProfile.id}`,
    })),
  );

  const results = await Promise.all(adminIds.map((userId) =>
    sendPushToUser(userId, {
      title,
      body: preview.slice(0, 160),
      url: link,
      tag: `inbox-${clientProfile.id}`,
    }),
  ));

  return results.reduce<{ sent: number; failed: number; reason?: string; subscriptionCount: number }>(
    (acc, result) => ({
      sent: acc.sent + result.sent,
      failed: acc.failed + result.failed,
      reason: acc.reason || result.reason,
      subscriptionCount: acc.subscriptionCount + (result.subscriptionCount ?? 0),
    }),
    { sent: 0, failed: 0, reason: undefined as string | undefined, subscriptionCount: 0 },
  );
}
