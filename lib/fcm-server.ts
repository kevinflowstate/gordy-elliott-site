import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFcmPayload, isPermanentFcmTokenFailure } from "@/lib/fcm-contract";
import { NATIVE_PUSH_APP_ID } from "@/lib/native-push-contract";
import type { PushChannelResult, PushMessage } from "@/lib/push-contract";

const APP_NAME = "at-capacity-android-push";

function loadMessaging() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return getMessaging(existing);
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
    throw new Error("Incomplete FCM service account configuration");
  }
  return getMessaging(initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: credentials.project_id,
  }, APP_NAME));
}

export async function sendAndroidPushToUser(userId: string, message: PushMessage): Promise<PushChannelResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("native_push_devices")
    .select("id, token, failure_count")
    .eq("user_id", userId).eq("app_id", NATIVE_PUSH_APP_ID)
    .eq("platform", "android").is("disabled_at", null);
  if (error) return { sent: 0, failed: 0, subscriptionCount: 0, reason: "Android device lookup failed." };
  const devices = data || [];
  if (!devices.length) return { sent: 0, failed: 0, subscriptionCount: 0 };

  let messaging;
  try {
    messaging = loadMessaging();
  } catch {
    // Never include credential content or parser errors in delivery diagnostics.
    return { sent: 0, failed: devices.length, subscriptionCount: devices.length, reason: "FCM configuration is invalid." };
  }
  if (!messaging) return { sent: 0, failed: 0, subscriptionCount: devices.length, reason: "FCM credentials are not configured." };

  const results = await Promise.all(devices.map(async (device) => {
    let code: string | undefined;
    try {
      await messaging.send(createFcmPayload(device.token, message));
    } catch (failure) {
      const providerCode = (failure as { code?: unknown })?.code;
      code = typeof providerCode === "string" && /^messaging\/[a-z-]+$/.test(providerCode)
        ? providerCode : "messaging/delivery-failed";
    }
    const now = new Date().toISOString();
    if (code || device.failure_count) {
      await admin.from("native_push_devices").update({
        failure_count: code ? device.failure_count + 1 : 0,
        last_failure: code || null,
        disabled_at: code && isPermanentFcmTokenFailure(code) ? now : null,
        updated_at: now,
      }).eq("id", device.id).eq("user_id", userId).eq("token", device.token);
    }
    return code;
  }));
  const reasons = [...new Set(results.filter((code): code is string => Boolean(code)))];
  return {
    sent: results.filter((code) => !code).length,
    failed: results.filter(Boolean).length,
    subscriptionCount: devices.length,
    reason: reasons.length ? reasons.join("; ") : undefined,
  };
}
