"use client";

import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { safeLocalRedirect } from "@/lib/safe-redirect";

const HANDLED_LAUNCH_URL_KEY = "shift-native-launch-url";

function isNativeRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  );
}

export default function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("native-app");
    void StatusBar.setOverlaysWebView({ overlay: false });
    // Capacitor Style.Dark is light status-bar content for dark backgrounds.
    void StatusBar.setStyle({ style: Style.Dark });
    void SplashScreen.hide({ fadeOutDuration: 250 });

    let disposed = false;
    let removeDeepLinkListener: (() => Promise<void>) | undefined;
    let navigatingUrl: string | undefined;

    const handleAppUrl = (url: string) => {
      try {
        const destination = new URL(url);
        if (destination.protocol === "shiftcoaching:") {
          const path = `/${destination.host}${destination.pathname}`.replace(/\/{2,}/g, "/");
          if (!isNativeRoute(path)) return;

          if (path === "/login") {
            const query = new URLSearchParams({
              redirect: safeLocalRedirect(destination.searchParams.get("redirect")),
            });
            window.location.assign(`/login?${query}`);
            return true;
          }

          window.location.assign(`${path}${destination.search}${destination.hash}`);
          return true;
        }

        if (destination.protocol === "http:" || destination.protocol === "https:") {
          if (destination.host !== window.location.host) return;
          if (!isNativeRoute(destination.pathname)) {
            void Browser.open({ url: destination.href });
            return true;
          }
          window.location.assign(`${destination.pathname}${destination.search}${destination.hash}`);
          return true;
        }
      } catch {
        // Ignore malformed URLs supplied by another application.
      }

      return false;
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

    const openExternalLinks = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const destination = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      const staysInNativeApp =
        destination.host === window.location.host &&
        isNativeRoute(destination.pathname) &&
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
      disposed = true;
      document.documentElement.classList.remove("native-app");
      document.removeEventListener("click", openExternalLinks);
      document.removeEventListener("click", provideHapticFeedback);
      void removeDeepLinkListener?.();
    };
  }, []);

  return null;
}
