import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InboxConversation, InboxMessage, UserRole } from "@/lib/types";

export interface InboxViewer {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
  clientProfileId: string | null;
}

interface ClientRecord {
  id: string;
  user_id: string;
  business_name: string | null;
}

interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

export async function getInboxViewer(): Promise<InboxViewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .maybeSingle<UserRecord>();

  if (!profile) return null;

  let clientProfileId: string | null = null;
  if (profile.role === "client") {
    const { data: clientProfile } = await admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();

    clientProfileId = clientProfile?.id ?? null;
  }

  return {
    userId: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email,
    clientProfileId,
  };
}

export async function listInboxConversations(viewer: InboxViewer): Promise<InboxConversation[]> {
  const admin = createAdminClient();

  const clientsQuery = admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .order("created_at", { ascending: true });

  const [clientsRes, usersRes, messagesRes] = await Promise.all([
    viewer.role === "client" && viewer.clientProfileId
      ? clientsQuery.eq("id", viewer.clientProfileId)
      : clientsQuery,
    admin.from("users").select("id, full_name, email, role").eq("role", "client"),
    viewer.role === "client" && viewer.clientProfileId
      ? admin
          .from("inbox_messages")
          .select("*")
          .eq("client_id", viewer.clientProfileId)
          .order("created_at", { ascending: false })
      : admin.from("inbox_messages").select("*").order("created_at", { ascending: false }),
  ]);

  return buildConversations(
    (clientsRes.data ?? []) as ClientRecord[],
    (usersRes.data ?? []) as UserRecord[],
    (messagesRes.data ?? []) as InboxMessage[],
    viewer.role,
  );
}

export async function getInboxThread(
  viewer: InboxViewer,
  requestedClientId?: string,
): Promise<{
  clientId: string;
  clientName: string;
  clientEmail: string;
  viewerUserId: string;
  messages: InboxMessage[];
} | null> {
  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : requestedClientId;

  if (!clientId) return null;

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .eq("id", clientId)
    .maybeSingle<ClientRecord>();

  if (!clientProfile) return null;
  if (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId) return null;

  const [userRes, messagesRes, sendersRes] = await Promise.all([
    admin
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", clientProfile.user_id)
      .maybeSingle<UserRecord>(),
    admin
      .from("inbox_messages")
      .select("*")
      .eq("client_id", clientProfile.id)
      .order("created_at", { ascending: true }),
    admin.from("users").select("id, full_name, email, role"),
  ]);

  const senderMap = new Map((sendersRes.data ?? []).map((user) => [user.id, user as UserRecord]));

  return {
    clientId: clientProfile.id,
    clientName: clientProfile.business_name || userRes.data?.full_name || "Client",
    clientEmail: userRes.data?.email || "",
    viewerUserId: viewer.userId,
    messages: ((messagesRes.data ?? []) as InboxMessage[]).map((message) => ({
      ...message,
      sender_name:
        viewer.role === "client" && message.sender_role === "admin"
          ? "Gordy"
          : senderMap.get(message.sender_user_id)?.full_name || (message.sender_role === "admin" ? "Gordy" : "Client"),
    })),
  };
}

export async function getInboxUnreadCount(viewer: InboxViewer): Promise<number> {
  const admin = createAdminClient();

  if (viewer.role === "client") {
    if (!viewer.clientProfileId) return 0;
    const { count } = await admin
      .from("inbox_messages")
      .select("*", { count: "exact", head: true })
      .eq("client_id", viewer.clientProfileId)
      .eq("sender_role", "admin")
      .eq("read_by_client", false);

    return count ?? 0;
  }

  const { count } = await admin
    .from("inbox_messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_role", "client")
    .eq("read_by_admin", false);

  return count ?? 0;
}

function buildConversations(
  clients: ClientRecord[],
  users: UserRecord[],
  messages: InboxMessage[],
  viewerRole: UserRole,
): InboxConversation[] {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const messageMap = new Map<string, InboxMessage[]>();

  for (const message of messages) {
    const bucket = messageMap.get(message.client_id) ?? [];
    bucket.push(message);
    messageMap.set(message.client_id, bucket);
  }

  return clients
    .map((client) => {
      const thread = messageMap.get(client.id) ?? [];
      const latest = thread[0] ?? null;
      const user = userMap.get(client.user_id);
      const unreadCount = thread.filter((message) =>
        viewerRole === "admin"
          ? message.sender_role === "client" && !message.read_by_admin
          : message.sender_role === "admin" && !message.read_by_client,
      ).length;

      return {
        client_id: client.id,
        client_name: client.business_name || user?.full_name || "Client",
        client_email: user?.email || "",
        latest_message: latest?.message?.trim() || null,
        latest_message_at: latest?.created_at ?? null,
        latest_sender_role: latest?.sender_role ?? null,
        unread_count: unreadCount,
      };
    })
    .sort((a, b) => {
      if (a.latest_message_at && b.latest_message_at) return b.latest_message_at.localeCompare(a.latest_message_at);
      if (a.latest_message_at) return -1;
      if (b.latest_message_at) return 1;
      return a.client_name.localeCompare(b.client_name);
    });
}
