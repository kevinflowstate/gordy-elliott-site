import { safeLocalRedirect } from "@/lib/safe-redirect";
import appIdentity from "@/config/app-identity.json";
import type { PushMessage } from "@/lib/push-contract";

export const NATIVE_PUSH_APP_ID = appIdentity.bundleId;
export type NativePushEnvironment = "sandbox" | "production";
export type NativePushPlatform = "ios" | "android";

export function normalizeNativePushPlatform(value: unknown): NativePushPlatform | null {
  // Released iPhone builds omit platform; retain their registration contract.
  return value == null || value === "ios" ? "ios" : value === "android" ? "android" : null;
}

export function normalizeNativePushToken(value: unknown, platform: NativePushPlatform) {
  if (platform === "ios") return normalizeApnsToken(value);
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[A-Za-z0-9_:\-]{32,4096}$/.test(token) ? token : null;
}

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
