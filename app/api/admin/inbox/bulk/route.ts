import { requireAdmin } from "@/lib/admin-auth";
import { notifyClientUser } from "@/lib/client-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isProgrammeType } from "@/lib/programmes";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { audience, message } = await request.json().catch(() => ({}));
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (audience !== "all" && !isProgrammeType(audience)) return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  if (!trimmed || trimmed.length > 4000) return NextResponse.json({ error: "Enter a message up to 4,000 characters" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  let query = admin
    .from("client_profiles")
    .select("id, user_id, programme_type")
    .eq("onboarding_status", "active")
    .eq("lifecycle_status", "active");
  if (audience !== "all") query = query.eq("programme_type", audience);
  const { data: clients, error: clientsError } = await query;
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });
  if (!clients?.length) return NextResponse.json({ error: "No active clients match that audience" }, { status: 400 });
  if (clients.length > 500) return NextResponse.json({ error: "Audience is too large for one send" }, { status: 400 });

  const { data: rows, error } = await admin.from("inbox_messages").insert(clients.map((client) => ({
    client_id: client.id,
    sender_user_id: user.id,
    sender_role: "admin",
    message: trimmed,
    message_type: "text",
    read_by_admin: true,
    read_by_client: false,
  }))).select("id, client_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const preview = trimmed.slice(0, 200);
  let notificationsAttempted = 0;
  let notificationFailures = 0;
  const notificationBatchSize = 5;
  for (let index = 0; index < clients.length; index += notificationBatchSize) {
    const batch = clients.slice(index, index + notificationBatchSize);
    const results = await Promise.allSettled(batch.map((client) => notifyClientUser(client.user_id, {
      title: "New message from Gordy",
      message: preview,
      link: "/portal/inbox",
      tag: `inbox-${client.id}`,
    })));
    notificationsAttempted += results.length;
    notificationFailures += results.filter((result) => result.status === "rejected").length;
  }
  return NextResponse.json({
    sent: rows?.length || 0,
    notificationsAttempted,
    notificationFailures,
  });
}
