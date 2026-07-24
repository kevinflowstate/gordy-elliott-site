"use client";

import { useEffect, useState } from "react";

export function useInboxUnreadCount(enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Founder clients have no inbox surface - polling would only collect
    // middleware 403s every 30 seconds.
    if (!enabled) return;

    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const res = await fetch("/api/inbox/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnreadCount(data.unreadCount || 0);
      } catch {
        // Non-critical nav badge state.
      }
    }

    void loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return enabled ? unreadCount : 0;
}
