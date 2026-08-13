"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  NATIVE_PUSH_REQUEST_EVENT,
  NATIVE_PUSH_STATUS_EVENT,
  type NativePushStatus,
  nativePushEnvironmentFromUserAgent,
} from "@/lib/native-push-client-contract";
import { rememberNativePushToken } from "@/lib/native-push-client";
import { safeLocalRedirect } from "@/lib/safe-redirect";
import { isNativeAppRoute, resolveNativeAppLink } from "@/lib/native-app-links";

const HANDLED_LAUNCH_URL_KEY = "shift-native-launch-url";
let pendingNativePushToken: string | null = null;

function publishNativePushStatus(status: NativePushStatus) {
  document.documentElement.dataset.nativePushStatus = status;
  window.dispatchEvent(new CustomEvent(NATIVE_PUSH_STATUS_EVENT, { detail: status }));
}

async function syncNativePushToken(token: string) {
  pendingNativePushToken = token;
  rememberNativePushToken(token);
  if (!window.location.pathname.startsWith("/portal")) return;

  try {
    const response = await fetch("/api/push/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        environment: nativePushEnvironmentFromUserAgent(navigator.userAgent),
      }),
    });
    if (response.ok) pendingNativePushToken = null;
  } catch {
    // Keep the token in memory and retry after the next authenticated navigation.
  }
}

export default function NativeAppBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("native-app");
    void StatusBar.setOverlaysWebView({ overlay: false });
    // Capacitor Style.Dark is light status-bar content for dark backgrounds.
    void StatusBar.setStyle({ style: Style.Dark });
    // Keep the complete brand mark visible through the first hydrated paint so
    // the native launch screen does not flash into a half-drawn portal shell.
    const splashTimer = window.setTimeout(() => {
      void SplashScreen.hide({ fadeOutDuration: 250 });
    }, 450);

    let disposed = false;
    let removeDeepLinkListener: (() => Promise<void>) | undefined;
    const removePushListeners: Array<() => Promise<void>> = [];
    let navigatingUrl: string | undefined;

    const handleAppUrl = (url: string) => {
      const destination = resolveNativeAppLink(url, window.location.host);
      if (!destination) return false;

      if (destination.action === "open-browser") {
        void Browser.open({ url: destination.href });
      } else {
        void Browser.close().catch(() => {});
        window.location.assign(destination.href);
      }
      return true;
    };

    const navigateToAppUrl = (url: string) => {
      if (navigatingUrl === url) return;
      navigatingUrl = url;
      sessionStorage.setItem(HANDLED_LAUNCH_URL_KEY, url);
      if (!handleAppUrl(url)) {
        navigatingUrl = undefined;
        sessionStorage.removeItem(HANDLED_LAUNCH_URL_KEY);
      }
    };

    void App.addListener("appUrlOpen", ({ url }: URLOpenListenerEvent) => navigateToAppUrl(url)).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      removeDeepLinkListener = () => handle.remove();
    });

    void App.getLaunchUrl().then((launch) => {
      if (disposed || !launch?.url) return;
      if (sessionStorage.getItem(HANDLED_LAUNCH_URL_KEY) === launch.url) return;
      navigateToAppUrl(launch.url);
    });

    const trackPushListener = (
      listener: Promise<{ remove: () => Promise<void> }>,
    ) => {
      void listener.then((handle) => {
        if (disposed) {
          void handle.remove();
          return;
        }
        removePushListeners.push(() => handle.remove());
      });
    };

    const registerForNativePush = async (requestPermission: boolean) => {
      if (!Capacitor.isPluginAvailable("PushNotifications")) {
        publishNativePushStatus("error");
        return;
      }

      try {
        let permission = await PushNotifications.checkPermissions();
        if (requestPermission && permission.receive === "prompt") {
          permission = await PushNotifications.requestPermissions();
        }

        if (permission.receive !== "granted") {
          publishNativePushStatus(permission.receive === "denied" ? "denied" : "prompt");
          return;
        }

        publishNativePushStatus("granted");
        await PushNotifications.register();
      } catch {
        publishNativePushStatus("error");
      }
    };

    const requestNativePush = () => {
      void registerForNativePush(true);
    };

    if (Capacitor.isPluginAvailable("PushNotifications")) {
      trackPushListener(PushNotifications.addListener("registration", ({ value }) => {
        publishNativePushStatus("granted");
        void syncNativePushToken(value);
      }));
      trackPushListener(PushNotifications.addListener("registrationError", () => {
        publishNativePushStatus("error");
      }));
      trackPushListener(PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const data = notification.data as { url?: unknown } | undefined;
        const destination = typeof data?.url === "string" ? safeLocalRedirect(data.url) : "/portal";
        window.location.assign(destination);
      }));
      void registerForNativePush(false);
    } else {
      publishNativePushStatus("error");
    }
    window.addEventListener(NATIVE_PUSH_REQUEST_EVENT, requestNativePush);

    const openExternalLinks = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const destination = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      const staysInNativeApp =
        destination.host === window.location.host &&
        isNativeAppRoute(destination.pathname) &&
        anchor.target !== "_blank";
      if (staysInNativeApp) return;

      event.preventDefault();
      void Browser.open({ url: destination.href });
    };

    const provideHapticFeedback = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-native-haptic]")) return;
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    };

    document.addEventListener("click", openExternalLinks);
    document.addEventListener("click", provideHapticFeedback);

    return () => {
      window.clearTimeout(splashTimer);
      disposed = true;
      document.documentElement.classList.remove("native-app");
      document.removeEventListener("click", openExternalLinks);
      document.removeEventListener("click", provideHapticFeedback);
      window.removeEventListener(NATIVE_PUSH_REQUEST_EVENT, requestNativePush);
      void removeDeepLinkListener?.();
      for (const remove of removePushListeners) void remove();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !pathname.startsWith("/portal")) return;
    if (pendingNativePushToken) void syncNativePushToken(pendingNativePushToken);
  }, [pathname]);

  return null;
}
