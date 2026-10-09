"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function DashboardDetail({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={ref} onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      aria-label={title} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-black/10 bg-bg-card p-0 text-text-primary shadow-2xl backdrop:bg-black/60">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/10 bg-bg-card px-5 py-4">
        <h2 className="text-lg font-heading font-bold">{title}</h2>
        <button type="button" autoFocus onClick={onClose} aria-label="Close details" className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-bright">Close</button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>, document.body,
  );
}
