"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { NATIVE_PUSH_TOKEN_STORAGE_KEY } from "@/lib/native-push-client-contract";

export function rememberNativePushToken(token: string) {
  localStorage.setItem(NATIVE_PUSH_TOKEN_STORAGE_KEY, token);
}

export async function unregisterNativePushDevice(options: { notifyServer?: boolean } = {}) {
  const token = localStorage.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);

  if (token && options.notifyServer !== false) {
    await fetch("/api/push/native", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
  }

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications")) {
    await PushNotifications.unregister().catch(() => {});
  }
  localStorage.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
}
