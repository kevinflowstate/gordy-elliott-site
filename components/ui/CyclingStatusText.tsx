"use client";

import { useEffect, useState } from "react";

const DEFAULT_MESSAGES = ["Working...", "Thinking...", "Checking...", "Nearly there..."];

export default function CyclingStatusText({
  active,
  idle,
  messages = DEFAULT_MESSAGES,
  intervalMs = 1400,
}: {
  active: boolean;
  idle: string;
  messages?: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [active, intervalMs, messages.length]);

  return <span aria-live="polite">{active ? messages[index] : idle}</span>;
}
