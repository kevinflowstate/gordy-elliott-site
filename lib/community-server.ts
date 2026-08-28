import { getInboxViewer } from "@/lib/inbox-server";
import { notifyClientUser } from "@/lib/client-notifications";
import { normalizeProgrammeType } from "@/lib/programmes";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunityMessage, UserRole } from "@/lib/types";

export interface CommunityViewer {
  userId: string;
  role: UserRole;
  fullName: string;
  clientProfileId: string | null;
}

type CommunityRow = {
  id: string;
  sender_user_id: string;
  sender_role: UserRole;
  message: string;
  message_type: "text" | "audio" | "image" | "file";
  media_bucket: string | null;
  media_path: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  media_duration_seconds: number | null;
  media_width: number | null;
  media_height: number | null;
  media_filename: string | null;
  created_at: string;
};

export async function getCommunityViewer(): Promise<CommunityViewer | null> {
  const viewer = await getInboxViewer();
  if (!viewer) return null;
  if (viewer.role === "admin") {
    return {
      userId: viewer.userId,
      role: viewer.role,
      fullName: viewer.fullName,
      clientProfileId: null,
    };
  }
  if (!viewer.clientProfileId) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("programme_type, onboarding_status, lifecycle_status")
    .eq("id", viewer.clientProfileId)
    .maybeSingle();

  if (
    !profile
    || normalizeProgrammeType(profile.programme_type) !== "shift"
    || profile.onboarding_status !== "active"
    || profile.lifecycle_status !== "active"
  ) return null;

  return {
    userId: viewer.userId,
    role: viewer.role,
    fullName: viewer.fullName,
    clientProfileId: viewer.clientProfileId,
  };
}

export async function listShiftCommunityMessages(): Promise<CommunityMessage[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("shift_community_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;

  const ordered = ((rows ?? []) as CommunityRow[]).reverse();
  const senderIds = [...new Set(ordered.map((row) => row.sender_user_id))];
  const { data: users } = senderIds.length > 0
    ? await admin.from("users").select("id, full_name").in("id", senderIds)
    : { data: [] };
  const mediaPaths = ordered.flatMap((row) => row.media_path ? [row.media_path] : []);
  const signedUrlMap = new Map<string, string>();
  if (mediaPaths.length > 0) {
    const { data: signedRows } = await admin.storage
      .from("shift-community-media")
      .createSignedUrls([...new Set(mediaPaths)], 60 * 10);
    for (const signed of signedRows ?? []) {
      if (signed.path && signed.signedUrl) signedUrlMap.set(signed.path, signed.signedUrl);
    }
  }

  const userMap = new Map((users ?? []).map((user) => [user.id, user]));
  return ordered.map((row) => {
    const url = row.media_path ? signedUrlMap.get(row.media_path) ?? null : null;
    const sender = userMap.get(row.sender_user_id);
    return {
      id: row.id,
      client_id: "shift-community",
      sender_user_id: row.sender_user_id,
      sender_role: row.sender_role,
      sender_name: row.sender_role === "admin" ? "Gordy" : sender?.full_name || "SHIFT member",
      message: row.message,
      message_type: row.message_type,
      audio_url: row.message_type === "audio" ? url : null,
      audio_bucket: row.message_type === "audio" ? row.media_bucket : null,
      audio_path: row.message_type === "audio" ? row.media_path : null,
      audio_mime_type: row.message_type === "audio" ? row.media_mime_type : null,
      audio_size_bytes: row.message_type === "audio" ? row.media_size_bytes : null,
      audio_duration_seconds: row.message_type === "audio" ? row.media_duration_seconds : null,
      image_url: row.message_type === "image" ? url : null,
      image_bucket: row.message_type === "image" ? row.media_bucket : null,
      image_path: row.message_type === "image" ? row.media_path : null,
      image_mime_type: row.message_type === "image" ? row.media_mime_type : null,
      image_size_bytes: row.message_type === "image" ? row.media_size_bytes : null,
      image_width: row.message_type === "image" ? row.media_width : null,
      image_height: row.message_type === "image" ? row.media_height : null,
      file_url: row.message_type === "file" ? url : null,
      file_name: row.message_type === "file" ? row.media_filename : null,
      file_mime_type: row.message_type === "file" ? row.media_mime_type : null,
      file_size_bytes: row.message_type === "file" ? row.media_size_bytes : null,
      read_by_admin: true,
      read_by_client: true,
      created_at: row.created_at,
    };
  });
}

export async function notifyCommunityPost(viewer: CommunityViewer, messageType: CommunityRow["message_type"], preview?: string) {
  const admin = createAdminClient();
  const summary = messageType === "text"
    ? (preview || "New community message").slice(0, 160)
    : messageType === "audio"
      ? "New voice note in the SHIFT community"
      : messageType === "image"
        ? "New photo in the SHIFT community"
        : "New file in the SHIFT community";

  if (viewer.role === "admin") {
    const { data: clients } = await admin
      .from("client_profiles")
      .select("user_id")
      .eq("programme_type", "shift")
      .eq("onboarding_status", "active")
      .eq("lifecycle_status", "active");
    const recipients = (clients ?? []).filter((client) => client.user_id !== viewer.userId);
    for (let index = 0; index < recipients.length; index += 5) {
      await Promise.allSettled(recipients.slice(index, index + 5).map((client) =>
        notifyClientUser(client.user_id, {
          title: "New message from Gordy in SHIFT",
          message: summary,
          link: "/portal/community",
          tag: "shift-community",
        }),
      ));
    }
    return;
  }

  const { data: admins } = await admin.from("users").select("id").eq("role", "admin");
  const title = `New SHIFT community post from ${viewer.fullName || "a client"}`;
  await Promise.allSettled((admins ?? []).map(async (adminUser) => {
    await admin.from("notifications").insert({
      user_id: adminUser.id,
      title,
      message: summary,
      link: "/admin/community",
      tag: "shift-community",
    });
    await sendPushToUser(adminUser.id, {
      title,
      body: summary,
      url: "/admin/community",
      tag: "shift-community",
    }, { lifecycleVerified: true });
  }));
}
