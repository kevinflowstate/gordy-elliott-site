"use client";

import { useState } from "react";
import { usePush } from "@/lib/use-push";
import { useInstall } from "@/lib/use-install";

const DISMISSED_KEY = "push-banner-dismissed";
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

export default function PushNotificationBanner() {
  const { permission, subscribed, subscribe } = usePush();
  const { canInstall, installed, install } = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    if (!hasPushSupport()) return true;
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });
  const [installDismissed, setInstallDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    const standaloneMode = isStandalone();
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "true" || standaloneMode;
  });
  const [loading, setLoading] = useState(false);
  const [standalone] = useState(() => isStandalone());

  const handleEnable = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  const [showManual, setShowManual] = useState(false);

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

  const handleDismissPush = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleDismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    setInstallDismissed(true);
  };

  // Show install banner if not standalone and not dismissed
  if (!installDismissed && !standalone && !installed) {
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
                Install SHIFT
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

  // Push notification banner
  if (dismissed || permission === "granted" || subscribed) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121212]/90 px-3 py-3 shadow-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <svg
          className="w-5 h-5 text-accent-light flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <p className="min-w-0 text-xs leading-snug text-white/85">
          Enable check-in reminders and coach updates.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="rounded-xl gradient-accent px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={handleDismissPush}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
