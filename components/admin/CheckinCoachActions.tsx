"use client";
import Link from "next/link";
import { useState } from "react";
import { checkinNeedsReview } from "@/lib/checkin-review";

export default function CheckinCoachActions({ checkin, onReviewed }: {
  checkin: { id: string; client_id: string; admin_reply?: string | null; reviewed_at?: string | null };
  onReviewed: (reviewedAt: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function markReviewed() {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/admin/review-checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkin_id: checkin.id, client_id: checkin.client_id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save review status");
      onReviewed(data.reviewed_at);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save review status"); }
    finally { setSaving(false); }
  }
  const hasReply = Boolean(checkin.admin_reply?.trim());
  return <div className="mt-3 border-t border-black/5 pt-3">
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/admin/inbox?client=${checkin.client_id}&${hasReply ? "checkin" : "reply_checkin"}=${checkin.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-accent/10 px-4 text-xs font-semibold text-accent-bright">{hasReply ? "Continue in DMs →" : "Reply in DMs →"}</Link>
      {checkinNeedsReview(checkin) ? <button type="button" disabled={saving} onClick={() => void markReviewed()} className="min-h-11 rounded-xl border border-black/10 px-4 text-xs font-semibold text-text-secondary disabled:opacity-50">{saving ? "Saving…" : "Mark reviewed"}</button> : <span className="text-xs font-medium text-emerald-500">{hasReply ? "Replied" : "Reviewed"}</span>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
  </div>;
}
