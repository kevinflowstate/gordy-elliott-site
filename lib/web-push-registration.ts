export function vapidKeyBytes(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function syncWebPushRegistration(
  registration: Pick<ServiceWorkerRegistration, "pushManager">,
  applicationServerKey: Uint8Array<ArrayBuffer>,
  create: boolean,
  send: (subscription: PushSubscriptionJSON) => Promise<boolean>,
) {
  let subscription = await registration.pushManager.getSubscription();
  const existingKey = subscription?.options.applicationServerKey;
  if (subscription && (!existingKey || existingKey.byteLength !== applicationServerKey.length ||
      !new Uint8Array(existingKey).every((byte, index) => byte === applicationServerKey[index]))) {
    if (!await subscription.unsubscribe()) return false;
    subscription = null;
  }
  if (!subscription && create) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  }
  // A local subscription is not ready until the authenticated server accepts it.
  return subscription ? await send(subscription.toJSON()) : false;
}

export async function readyPushServiceWorker(serviceWorker: ServiceWorkerContainer) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Notification service is not ready")), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
