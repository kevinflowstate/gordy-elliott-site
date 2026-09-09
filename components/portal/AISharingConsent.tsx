"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AI_CONSENT_DATA, AI_CONSENT_RECIPIENTS, AI_CONSENT_VERSION, type AIConsentState } from "@/lib/ai-consent";

export default function AISharingConsent({ onChange }: { onChange?: (granted: boolean) => void }) {
  const [consent, setConsent] = useState<AIConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/portal/ai/consent", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI sharing could not be checked. Reload to try again.");
        return response.json() as Promise<AIConsentState>;
      })
      .then((state) => { if (active) { setConsent(state); onChange?.(state.granted); } })
      .catch((err) => { if (active) { setError(err.message); onChange?.(false); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onChange]);

  async function choose(granted: boolean) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/portal/ai/consent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granted, version: AI_CONSENT_VERSION }),
      });
      const state = await response.json();
      if (!response.ok) throw new Error(state.error || "Your choice could not be saved.");
      setConsent(state); onChange?.(state.granted);
      setNotice(granted ? "AI sharing is on." : "AI sharing is off. Your coaching features remain available.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your choice could not be saved.");
    } finally { setSaving(false); }
  }

  return (
    <section aria-labelledby="ai-sharing-title" className="rounded-2xl border border-white/10 bg-bg-card p-5">
      <h2 id="ai-sharing-title" className="text-lg font-heading font-bold text-text-primary">AI sharing</h2>
      {loading ? <p className="mt-2 text-sm text-text-secondary" role="status">Checking your choice…</p> : <>
        <p className="mt-2 text-sm font-semibold text-text-primary">{consent?.granted ? "On — you can withdraw permission below." : "Optional — off until you choose to allow it."}</p>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{AI_CONSENT_DATA}</p>
        <p className="mt-3 text-sm leading-6 text-text-secondary">If you allow it, AT CAPACITY shares this information with {AI_CONSENT_RECIPIENTS} for AI replies, consultation summaries and AI-assisted coaching prepared by Gordy. Your AI questions may also be sent to OpenAI through OpenRouter to find relevant coaching guidance.</p>
        <p className="mt-3 text-sm leading-6 text-text-secondary">Calendar data is excluded. AI can be wrong and is not medical advice. You can use your plans, tracker and private coach messages without AI. Withdraw here or in Settings at any time; new AI requests will stop, while processing already started may finish. Previously saved coaching summaries remain subject to the <Link href="/privacy" className="text-accent-bright underline">privacy policy</Link>.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {consent?.granted ? <button type="button" disabled={saving} onClick={() => void choose(false)} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-semibold text-text-primary disabled:opacity-50">{saving ? "Saving…" : "Withdraw AI permission"}</button> : <>
            <button type="button" disabled={saving || !consent} onClick={() => void choose(true)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Allow AI sharing"}</button>
            <button type="button" disabled={saving || !consent} onClick={() => void choose(false)} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-semibold text-text-primary disabled:opacity-50">Keep AI off</button>
          </>}
        </div>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-text-secondary">{notice}</p>}
    </section>
  );
}
