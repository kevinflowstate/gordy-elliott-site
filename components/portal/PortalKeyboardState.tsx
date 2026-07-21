"use client";

import { useEffect } from "react";

function isTextEntry(element: Element | null) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "color", "date", "file", "radio", "range", "reset", "submit"].includes(element.type);
}

export default function PortalKeyboardState() {
  useEffect(() => {
    const root = document.documentElement;
    let blurTimer = 0;
    let frame = 0;
    let lastHeight = "";
    let lastKeyboardOpen: boolean | null = null;

    const apply = () => {
      const viewport = window.visualViewport;
      const inset = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
        : 0;
      const focused = isTextEntry(document.activeElement);
      const keyboardOpen = focused && (inset > 24 || root.classList.contains("native-app"));

      const height = `${Math.round(viewport?.height || window.innerHeight)}px`;
      if (height !== lastHeight) {
        root.style.setProperty("--portal-visual-height", height);
        lastHeight = height;
      }
      if (keyboardOpen !== lastKeyboardOpen) {
        root.classList.toggle("portal-keyboard-open", keyboardOpen);
        lastKeyboardOpen = keyboardOpen;
      }
    };

    const scheduleApply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    const handleFocusIn = () => {
      window.clearTimeout(blurTimer);
      scheduleApply();
    };
    const handleFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(scheduleApply, 80);
    };

    apply();
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleApply, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleApply, { passive: true });

    return () => {
      window.clearTimeout(blurTimer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("resize", scheduleApply);
      window.visualViewport?.removeEventListener("resize", scheduleApply);
      window.visualViewport?.removeEventListener("scroll", scheduleApply);
      root.classList.remove("portal-keyboard-open");
      root.style.removeProperty("--portal-visual-height");
    };
  }, []);

  return null;
}
