"use client";

import { useSyncExternalStore } from "react";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MIN_FOREGROUND_REFRESH_INTERVAL_MS = 30 * 1000;

let unreadCount = 0;
let lastFetchedAt = 0;
let requestInFlight: Promise<void> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

async function refreshUnreadCount(force = false) {
  if (document.hidden || requestInFlight) return requestInFlight;
  if (!force && Date.now() - lastFetchedAt < MIN_FOREGROUND_REFRESH_INTERVAL_MS) return;

  requestInFlight = (async () => {
    try {
      const res = await fetch("/api/inbox/unread-count");
      if (!res.ok) return;
      const data = await res.json();
      if (listeners.size === 0) return;

      const nextUnreadCount = Number(data.unreadCount) || 0;
      if (nextUnreadCount !== unreadCount) {
        unreadCount = nextUnreadCount;
        emitChange();
      }
    } catch {
      // Non-critical nav badge state.
    } finally {
      lastFetchedAt = Date.now();
      requestInFlight = null;
    }
  })();

  return requestInFlight;
}

function handleForeground() {
  if (!document.hidden) void refreshUnreadCount();
}

function startPolling() {
  void refreshUnreadCount(true);
  pollInterval = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleForeground);
  window.addEventListener("focus", handleForeground);
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
  document.removeEventListener("visibilitychange", handleForeground);
  window.removeEventListener("focus", handleForeground);
  unreadCount = 0;
  lastFetchedAt = 0;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) startPolling();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
}

function subscribeDisabled() {
  return () => {};
}

function getSnapshot() {
  return unreadCount;
}

function getServerSnapshot() {
  return 0;
}

export function useInboxUnreadCount(enabled = true) {
  // Sidebar and MobileNav are mounted together. A shared external store keeps
  // them on one request/timer instead of polling the same endpoint twice.
  const count = useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    getSnapshot,
    getServerSnapshot,
  );

  return enabled ? count : 0;
}
