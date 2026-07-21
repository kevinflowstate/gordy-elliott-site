import { safeLocalRedirect } from "@/lib/safe-redirect";
import appIdentity from "@/config/app-identity.json";
import type { PushMessage } from "@/lib/push-contract";

export const NATIVE_PUSH_APP_ID = appIdentity.bundleId;
export type NativePushEnvironment = "sandbox" | "production";

export function normalizeNativePushEnvironment(value: unknown): NativePushEnvironment | null {
  return value === "sandbox" || value === "production" ? value : null;
}

export function normalizeApnsToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[a-f0-9]{32,256}$/i.test(token) ? token.toLowerCase() : null;
}

export function defaultNativePushEnvironment(): NativePushEnvironment {
  return process.env.APNS_DEFAULT_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

export function createApnsPayload(message: PushMessage) {
  const title = message.title.trim().slice(0, 120);
  const body = message.body?.trim().slice(0, 240);
  const tag = message.tag?.trim().slice(0, 64);

  return {
    aps: {
      alert: body ? { title, body } : { title },
      sound: "default",
      ...(tag ? { "thread-id": tag } : {}),
    },
    url: safeLocalRedirect(message.url, "/portal").slice(0, 512),
  };
}
