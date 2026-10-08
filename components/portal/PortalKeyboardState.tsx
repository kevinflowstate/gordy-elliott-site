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
    let lastTop = "";
    let restingHeight = window.innerHeight;
    let lastWidth = window.innerWidth;
    let lastKeyboardOpen: boolean | null = null;

    const apply = () => {
      const viewport = window.visualViewport;
      const inset = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
        : 0;
      const focused = isTextEntry(document.activeElement);
      if (window.innerWidth !== lastWidth || (!focused && inset < 24)) {
        restingHeight = window.innerHeight;
        lastWidth = window.innerWidth;
      }
      const keyboardOpen = focused && (inset > 24
        || restingHeight - (viewport?.height || window.innerHeight) > 100
        || root.classList.contains("native-app"));
      const top = `${Math.max(0, Math.round(viewport?.offsetTop || 0))}px`;
      if (top !== lastTop) {
        root.style.setProperty("--portal-visual-top", top);
        lastTop = top;
      }

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
      root.style.removeProperty("--portal-visual-top");
    };
  }, []);

  return null;
}
