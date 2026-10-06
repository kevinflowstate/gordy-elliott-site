"use client";

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { normalizeVapidKey } from "@/lib/vapid";
import { readyPushServiceWorker, syncWebPushRegistration, vapidKeyBytes } from "@/lib/web-push-registration";
import { postPushRegistration } from "@/lib/push-registration-client";

function hasWebPushSupport() {
  return !Capacitor.isNativePlatform() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function syncRegistration(create: boolean) {
  const key = normalizeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  if (!key) return false;
  const registration = await readyPushServiceWorker(navigator.serviceWorker);
  return syncWebPushRegistration(registration, vapidKeyBytes(key), create,
    (subscription) => postPushRegistration("/api/push/subscribe", subscription));
}

export function usePush() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasWebPushSupport()) { setChecking(false); return; }
    const current = Notification.permission;
    setPermission(current);
    if (current !== "granted") { setSubscribed(false); setChecking(false); return; }
    try {
      const synced = await syncRegistration(false);
      setSubscribed(synced);
      setError(!synced);
    } catch {
      setSubscribed(false);
      setError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!hasWebPushSupport()) return false;
    setError(false);
    try {
      // Keep the permission request within the client's explicit button click.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") { setSubscribed(false); return false; }
      const synced = await syncRegistration(true);
      setSubscribed(synced);
      setError(!synced);
      return synced;
    } catch {
      setSubscribed(false);
      setError(true);
      return false;
    }
  }, []);

  return { permission, subscribed, subscribe, refresh, checking, error };
}
