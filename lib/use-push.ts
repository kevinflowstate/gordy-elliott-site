"use client";

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function buffersMatch(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a) return false;
  const left = new Uint8Array(a);
  if (left.length !== b.length) return false;
  return left.every((value, index) => value === b[index]);
}

async function syncSubscription(subscription: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  return res.ok;
}

export function usePush() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check if already subscribed
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then(async (sub) => {
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const currentKey = vapidKey ? urlBase64ToUint8Array(vapidKey) : null;
          if (sub && currentKey && !buffersMatch(sub.options.applicationServerKey, currentKey)) {
            await sub.unsubscribe();
            setSubscribed(false);
            return;
          }

          setSubscribed(!!sub);
          // Browser permission alone is not enough: after login/device changes,
          // make sure the server has the active endpoint for this user.
          if (sub && Notification.permission === "granted") {
            await syncSubscription(sub);
          }
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);

    let existing = await reg.pushManager.getSubscription();
    if (existing && !buffersMatch(existing.options.applicationServerKey, applicationServerKey)) {
      await existing.unsubscribe();
      existing = null;
    }
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to server
    if (await syncSubscription(sub)) {
      setSubscribed(true);
      return true;
    }
    return false;
  }, []);

  return { permission, subscribed, subscribe };
}
