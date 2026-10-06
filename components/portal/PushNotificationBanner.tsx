"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import {
  NATIVE_PUSH_REQUEST_EVENT,
  NATIVE_PUSH_STATUS_EVENT,
  type NativePushStatus,
  normalizeNativePushStatus,
} from "@/lib/native-push-client-contract";
import { usePush } from "@/lib/use-push";
import { useInstall } from "@/lib/use-install";
import { createClient } from "@/lib/supabase/client";

const INTRO_KEY = "push-intro-v2:";

function readStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string) {
  try { localStorage.setItem(key, "true"); } catch { /* Storage is optional. */ }
}
const INSTALL_DISMISSED_KEY = "install-banner-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

function hasPushSupport() {
  return typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

export default function PushNotificationBanner() {
  const { permission, subscribed, subscribe, refresh, checking, error } = usePush();
  const { canInstall, installed, install } = useInstall();
  const [userId, setUserId] = useState<string | null>(null);
  const [introSeen, setIntroSeen] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [nativePushStatus, setNativePushStatus] = useState<NativePushStatus>("unknown");
  const hydrated = useHydrated();
  const nativeApp = hydrated && Capacitor.isNativePlatform();
  const standalone = hydrated && isStandalone();
  const installBannerDismissed =
    !hydrated ||
    nativeApp ||
    installDismissed ||
    standalone ||
    readStorage(INSTALL_DISMISSED_KEY) === "true";

  useEffect(() => {
    // INITIAL_SESSION and subsequent logins give each account its own first-use prompt.
    // This is only UI state; server routes still validate authentication themselves.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      setUserId(id);
      setIntroSeen(!id || readStorage(INTRO_KEY + id) === "true");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const finishIntro = () => {
    if (userId) writeStorage(INTRO_KEY + userId);
    setIntroSeen(true);
  };

  useEffect(() => {
    if (!nativeApp) return;

    const current = document.documentElement.dataset.nativePushStatus;
    if (current) queueMicrotask(() => setNativePushStatus(normalizeNativePushStatus(current)));
    const handleStatus = (event: Event) => {
      const status = (event as CustomEvent<NativePushStatus>).detail;
      setNativePushStatus(status);
      if (status !== "registering") setLoading(false);
    };
    window.addEventListener(NATIVE_PUSH_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(NATIVE_PUSH_STATUS_EVENT, handleStatus);
  }, [nativeApp]);

  const handleEnable = async () => {
    finishIntro();
    setLoading(true);
    if (nativeApp) {
      window.dispatchEvent(new Event(NATIVE_PUSH_REQUEST_EVENT));
      return;
    }
    try { await subscribe(); } finally { setLoading(false); }
  };

  const handleInstall = async () => {
    setLoading(true);
    const success = await install();
    setLoading(false);
    if (success) {
      setInstallDismissed(true);
    } else {
      // Native prompt not available -- show manual instructions
      setShowManual(true);
    }
  };

  const handleDismissInstall = () => {
    writeStorage(INSTALL_DISMISSED_KEY);
    setInstallDismissed(true);
  };

  if (!hydrated) return null;

  const pushSupported = nativeApp || hasPushSupport();
  const registered = nativeApp ? nativePushStatus === "registered" : subscribed;
  const denied = nativeApp ? nativePushStatus === "denied" : permission === "denied";
  const needsRetry = nativeApp ? nativePushStatus === "error" || nativePushStatus === "granted" : error || permission === "granted";
  const busy = loading || (nativeApp && nativePushStatus === "registering");
  const initialPrompt = !!userId && !introSeen && !denied && !needsRetry &&
    (nativeApp ? nativePushStatus === "prompt" : permission === "default");

  // Installing is necessary for iPhone web push. Supported browsers can enable push directly.
  if (!nativeApp && !installBannerDismissed && !installed && (!pushSupported || registered)) {
    return (
      <div className="mb-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121212]/92 px-3 py-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <svg
              className="h-4 w-4 flex-shrink-0 text-accent-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                Install AT CAPACITY
              </p>
              <p className="hidden text-xs leading-snug text-white/70 min-[420px]:block">Home-screen shortcut and reminders.</p>
              {showManual && (
                <div className="mt-2 space-y-1 text-xs leading-snug text-accent-light">
                  <p>Use your browser menu, then Add to Home Screen.</p>
                  <p className="text-white/70">If this opened in another app, open it in your browser first.</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {canInstall && (
              <button
                onClick={handleInstall}
                disabled={loading}
                className="min-h-9 rounded-xl px-3 py-1.5 text-xs font-semibold text-white gradient-accent transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Installing..." : "Install"}
              </button>
            )}
            <button
              onClick={handleDismissInstall}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pushSupported || registered || !userId ||
      (nativeApp ? nativePushStatus === "unknown" : checking)) return null;

  const title = initialPrompt ? "Stay in touch with Gordy" : denied ? "Turn on notifications" :
    needsRetry ? "Finish setting up notifications" : "Get your coaching updates";
  const description = denied ? "Notifications are off. Enable them in settings to get messages and reminders." :
    needsRetry ? "Notifications aren’t connected yet. Try again to receive your coaching updates." :
    "Get a heads-up when Gordy messages you, updates your plan or sends a check-in reminder.";

  return (
    <section aria-label="Notification settings" className="mb-4 rounded-2xl border border-white/10 bg-[#121212] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{description}</p>
          {denied && (
            <p className="mt-2 text-xs leading-relaxed text-accent-light">
              {nativeApp ? Capacitor.getPlatform() === "android" ?
                "On your phone: Settings → Apps → AT CAPACITY → Notifications. Allow notifications, then return here." :
                "On your iPhone: Settings → Notifications → AT CAPACITY. Turn on Allow Notifications, then return here." :
                "Open your browser’s settings for this website and allow notifications, then check again. If you installed the iPhone web app, use Settings → Notifications → AT CAPACITY."}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={denied && !nativeApp ? () => void refresh() : handleEnable} disabled={busy}
              className="min-h-11 rounded-xl gradient-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer">
              {busy ? "Connecting…" : denied ? "Check again" : needsRetry ? "Try again" : "Turn on notifications"}
            </button>
            {initialPrompt && (
              <button onClick={finishIntro} className="min-h-11 rounded-xl px-3 py-2 text-xs text-white/60 hover:text-white cursor-pointer">Not now</button>
            )}
          </div>
          {initialPrompt && <p className="mt-2 text-[11px] text-white/45">You can change this in your notification settings at any time.</p>}
        </div>
      </div>
    </section>
  );
}
