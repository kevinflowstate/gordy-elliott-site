import { safeLocalRedirect } from "@/lib/safe-redirect";
import type { PushMessage } from "@/lib/push-contract";

export const ANDROID_NOTIFICATION_CHANNEL = "coaching_updates";

export function createFcmPayload(token: string, message: PushMessage) {
  return {
    token,
    notification: {
      title: message.title.trim().slice(0, 120),
      ...(message.body ? { body: message.body.trim().slice(0, 240) } : {}),
    },
    data: { url: safeLocalRedirect(message.url, "/portal").slice(0, 512) },
    android: {
      priority: "high" as const,
      notification: {
        channelId: ANDROID_NOTIFICATION_CHANNEL,
        icon: "ic_stat_capacity",
        color: "#E040D0",
        sound: "default",
        ...(message.tag ? { tag: message.tag.trim().slice(0, 64) } : {}),
      },
    },
  };
}

export function isPermanentFcmTokenFailure(code: string) {
  // Payload, credentials, project mismatch and quota errors must not retire a device.
  return code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token";
}
