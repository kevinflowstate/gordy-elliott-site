import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVapidKey } from "@/lib/vapid";
import webpush from "web-push";

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body?: string; url?: string; tag?: string }
): Promise<{ sent: number; failed: number; reason?: string; subscriptionCount?: number }> {
  const vapidPublicKey = normalizeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const vapidPrivateKey = normalizeVapidKey(process.env.VAPID_PRIVATE_KEY);

  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: 0, failed: 0, reason: "Push server keys are missing in this environment.", subscriptionCount: 0 };
  }

  webpush.setVapidDetails(
    "mailto:kevin.flowstate@gmail.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", userId);

  if (error) {
    return { sent: 0, failed: 0, reason: error.message, subscriptionCount: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, reason: "No push subscription is saved for this client. Ask them to re-enable notifications while logged in.", subscriptionCount: 0 };
  }

  const payload = JSON.stringify(notification);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as webpush.PushSubscription["keys"] },
        payload
      )
    )
  );

  // Clean up expired subscriptions
  const expired = results
    .map((r, i) =>
      r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410
        ? subscriptions[i].endpoint
        : null
    )
    .filter(Boolean);

  if (expired.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    reason: results.some((r) => r.status === "rejected")
      ? results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r) => (r.reason as { body?: string; message?: string })?.body || (r.reason as { message?: string })?.message || "Push provider rejected the notification")
          .join("; ")
      : undefined,
    subscriptionCount: subscriptions.length,
  };
}
