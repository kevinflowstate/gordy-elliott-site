import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

type ClientNotification = {
  title: string;
  message: string;
  link?: string;
  tag?: string;
};

export async function notifyClientUser(userId: string, notification: ClientNotification) {
  const admin = createAdminClient();
  const link = notification.link || "/portal";

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    title: notification.title,
    message: notification.message,
    link,
  });

  if (error) {
    console.error("Failed to create client notification:", error);
  }

  try {
    const pushResult = await sendPushToUser(userId, {
      title: notification.title,
      body: notification.message.slice(0, 160),
      url: link,
      tag: notification.tag,
    });

    if (pushResult.failed > 0 || pushResult.sent === 0) {
      console.error("Failed to deliver client push:", pushResult);
    }

    return pushResult;
  } catch (error) {
    console.error("Failed to send client push:", error);
    return {
      sent: 0,
      failed: 0,
      reason: error instanceof Error ? error.message : "Push send failed.",
      subscriptionCount: 0,
    };
  }
}

export async function notifyClientProfile(clientId: string, notification: ClientNotification) {
  const admin = createAdminClient();
  const { data: clientProfile, error } = await admin
    .from("client_profiles")
    .select("user_id")
    .eq("id", clientId)
    .single();

  if (error || !clientProfile?.user_id) {
    console.error("Failed to resolve client user for notification:", error);
    return { sent: 0, failed: 0, reason: "Client user could not be resolved.", subscriptionCount: 0 };
  }

  return notifyClientUser(clientProfile.user_id, notification);
}
