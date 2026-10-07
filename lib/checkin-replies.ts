import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoachCheckinReply {
  id: string;
  created_at: string;
  admin_reply: string | null;
  replied_at: string | null;
  reply_message_id: string | null;
}

export function canReadCoachCheckinReplies(tier: unknown) {
  return tier === "coached" || tier === "premium" || tier === "vip";
}

export function coachCheckinReplies<T extends { created_at: string; admin_reply?: string | null; replied_at?: string | null }>(checkins: T[]): T[] {
  return checkins
    .filter((checkin) => typeof checkin.admin_reply === "string" && checkin.admin_reply.trim())
    .sort((a, b) => Date.parse(b.replied_at || b.created_at) - Date.parse(a.replied_at || a.created_at));
}

export function coachCheckinReplyHref(reply: { id: string; reply_message_id?: string | null }) {
  return reply.reply_message_id
    ? `/portal/inbox?message=${encodeURIComponent(reply.reply_message_id)}`
    : `/portal/checkin#coach-reply-${encodeURIComponent(reply.id)}`;
}

// The client id must come from the authenticated profile, never a URL parameter.
export async function loadCoachCheckinReplies(admin: SupabaseClient, clientId: string, tier: unknown) {
  if (!canReadCoachCheckinReplies(tier)) return { replies: [], unavailable: false };
  const { data, error } = await admin
    .from("checkins")
    .select("id, created_at, admin_reply, replied_at, reply_message_id")
    .eq("client_id", clientId)
    .not("admin_reply", "is", null)
    .order("replied_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return {
    replies: coachCheckinReplies((data || []) as CoachCheckinReply[]),
    unavailable: Boolean(error),
  };
}
