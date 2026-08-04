"use client";

import { useEffect, useState } from "react";

const supportedProviders = new Set(["garmin", "oura", "fitbit", "myfitnesspal"]);

export default function ConnectedAppReturnPage() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status") === "success" ? "success" : "failed";
    const requestedProvider = params.get("provider") || "";
    const provider = supportedProviders.has(requestedProvider) ? requestedProvider : "";
    const appParams = new URLSearchParams({ terra: status });
    if (provider) appParams.set("provider", provider);
    window.location.replace(`shiftcoaching://portal/connected-apps?${appParams}`);

    const timeout = window.setTimeout(() => setShowFallback(true), 1_500);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6 text-center">
      <section className="app-card w-full max-w-md rounded-[28px] p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-bright">AT CAPACITY</p>
        <h1 className="mt-3 font-heading text-2xl font-bold text-text-primary">Returning to the app…</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Your connection details have been received. AT CAPACITY should reopen automatically.
        </p>
        {showFallback && (
          <a
            href="/login?redirect=%2Fportal%2Fconnected-apps"
            className="mt-6 inline-flex rounded-xl gradient-accent px-5 py-3 text-sm font-semibold text-white no-underline"
          >
            Continue to AT CAPACITY
          </a>
        )}
      </section>
    </main>
  );
}
