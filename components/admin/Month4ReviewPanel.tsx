"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CapacityMetrics } from "@/lib/capacity-baseline";
import type { FounderComplianceSummary } from "@/lib/founder-compliance";
import type { Month4Snapshot } from "@/lib/founder-compliance-server";

type Month4Review = {
  id: string;
  client_id: string;
  review_date: string;
  status: "draft" | "completed";
  baseline_comparison: Month4Snapshot["baseline_comparison"] | null;
  compliance_summary: FounderComplianceSummary | null;
  outcome_note: string | null;
  completed_at: string | null;
  created_at: string;
};

type Month4Response = {
  review: Month4Review | null;
  live: Month4Snapshot | null;
  liveBlockedReason: string | null;
};

const metricFields: Array<{ key: keyof CapacityMetrics; label: string; unit: string }> = [
  { key: "hrv_ms", label: "HRV", unit: "ms" },
  { key: "resting_hr_bpm", label: "Resting HR", unit: "bpm" },
  { key: "sleep_minutes", label: "Sleep", unit: "min" },
  { key: "sleep_score", label: "Sleep score", unit: "" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "body_fat_percentage", label: "Body fat", unit: "%" },
  { key: "waist_cm", label: "Waist", unit: "cm" },
];

function display(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "—" : `${Math.round(value * 10) / 10}${unit ? ` ${unit}` : ""}`;
}

function longDate(dateKey: string) {
  const parsed = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ComparisonBlock({ snapshot }: { snapshot: Month4Snapshot["baseline_comparison"] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metricFields.map((field) => {
          const value = snapshot.comparison[field.key];
          return (
            <div key={field.key} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">{field.label}</div>
              <div className="mt-1 text-sm font-bold text-text-primary">{display(value?.current, field.unit)}</div>
              <div className={`mt-1 text-[10px] ${
                value?.direction === "improved"
                  ? "text-emerald-500"
                  : value?.direction === "declined"
                    ? "text-amber-500"
                    : "text-text-muted"
              }`}>
                {value?.delta === null || value?.delta === undefined
                  ? "No comparison"
                  : `${value.delta > 0 ? "+" : ""}${value.delta} from baseline`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-text-muted">
        {snapshot.source_period.description} {longDate(snapshot.source_period.start)} to {longDate(snapshot.source_period.end)}
        {" · "}
        {snapshot.comparison_period.description.toLowerCase()} {longDate(snapshot.comparison_period.start)} to {longDate(snapshot.comparison_period.end)}.
        {" "}
        {snapshot.wearable_source_days.current === 0
          ? "No wearable days in the comparison period - missing days are shown as missing, not zero."
          : `${snapshot.wearable_source_days.current} wearable day${snapshot.wearable_source_days.current === 1 ? "" : "s"} in the comparison period.`}
      </p>
      <div className="mt-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Guarantee</div>
        {snapshot.guarantee === null ? (
          <p className="mt-1 text-xs text-text-secondary">
            Guarantee thresholds are not configured. Nothing is evaluated until Gordy confirms the exact definition.
          </p>
        ) : (
          <div className="mt-1 text-xs text-text-secondary">
            <span className={`font-semibold ${
              snapshot.guarantee.met === true
                ? "text-emerald-500"
                : snapshot.guarantee.met === false
                  ? "text-amber-500"
                  : "text-text-primary"
            }`}>
              {snapshot.guarantee.met === true
                ? "Condition met"
                : snapshot.guarantee.met === false
                  ? "Condition not met"
                  : "Cannot be evaluated"}
            </span>
            {" - "}
            {snapshot.guarantee.reason}
            {snapshot.guarantee.met === false && snapshot.guarantee.remedy_text && (
              <p className="mt-1 text-text-muted">Agreed remedy: {snapshot.guarantee.remedy_text}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ComplianceFacts({ summary }: { summary: FounderComplianceSummary }) {
  const checkinFact = summary.checkins.expected_weeks === 0
    ? "No full weeks yet"
    : `${summary.checkins.submitted_weeks} of ${summary.checkins.expected_weeks} weeks submitted`;
  const callFact = summary.calls.recorded === 0
    ? "No calls recorded yet"
    : `Attended ${summary.calls.attended} of ${summary.calls.recorded} recorded calls`;
  const whatsappFact = summary.whatsapp.weeks_recorded === 0
    ? "No WhatsApp weeks recorded yet"
    : `Helped in ${summary.whatsapp.weeks_helped} of ${summary.whatsapp.weeks_recorded} recorded weeks`;
  return (
    <div className="mt-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        Compliance over the last {summary.window_weeks} full weeks
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-text-secondary">
        <li>Check-ins: {checkinFact}</li>
        <li>Calls: {callFact}</li>
        <li>WhatsApp: {whatsappFact}</li>
      </ul>
    </div>
  );
}

export default function Month4ReviewPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Month4Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewDate, setReviewDate] = useState("");
  const [outcomeNote, setOutcomeNote] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/client-month4-review?client_id=${clientId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Month 4 review could not be loaded");
      setData(payload);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Month 4 review could not be loaded", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-month4-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, review_date: reviewDate }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Review draft could not be created");
      toast("Month 4 review draft created");
      setReviewDate("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Review draft could not be created", "error");
    } finally {
      setSaving(false);
    }
  }

  async function completeReview(reviewId: string) {
    if (!window.confirm("Complete the Month 4 review? The comparison and compliance facts freeze as they are now and cannot be changed afterwards.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-month4-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", review_id: reviewId, outcome_note: outcomeNote }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Review could not be completed");
      toast("Month 4 review completed");
      setOutcomeNote("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Review could not be completed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeDraft(reviewId: string) {
    if (!window.confirm("Remove this draft review?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/client-month4-review?review_id=${reviewId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Draft could not be removed");
      toast("Draft removed");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Draft could not be removed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl bg-bg-card" />;
  }
  if (!data) return null;

  const review = data.review;
  const inputClass = "mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary";

  return (
    <section className="mb-6 rounded-2xl border border-[#E040D0]/18 bg-bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Month 4 review</div>
          <h2 className="mt-1 font-heading text-lg font-bold text-text-primary">Baseline vs now, on the record</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            The same comparison the client sees - locked Month 1 baseline against the latest 14 days. Completing the review freezes it.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
          review?.status === "completed"
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : review
              ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
              : "border-[rgba(0,0,0,0.10)] bg-bg-primary text-text-muted"
        }`}>
          {review?.status === "completed" ? "Completed" : review ? "Draft" : "Not started"}
        </span>
      </div>

      {review?.status === "completed" && review.baseline_comparison && review.compliance_summary ? (
        <div className="mt-4">
          <ComparisonBlock snapshot={review.baseline_comparison} />
          <ComplianceFacts summary={review.compliance_summary} />
          {review.outcome_note && (
            <div className="mt-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Outcome note</div>
              <p className="mt-1 text-xs text-text-secondary">{review.outcome_note}</p>
            </div>
          )}
          <p className="mt-2 text-[11px] text-text-muted">
            Reviewed {longDate(review.review_date)}
            {review.completed_at ? ` · completed ${new Date(review.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}.
            Completed reviews are immutable.
          </p>
        </div>
      ) : review ? (
        <div className="mt-4">
          {data.live ? (
            <>
              <ComparisonBlock snapshot={data.live.baseline_comparison} />
              <ComplianceFacts summary={data.live.compliance_summary} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.10)] bg-bg-primary px-4 py-3 text-sm text-text-secondary">
              {data.liveBlockedReason || "The live comparison is not available yet."}
            </div>
          )}
          <label className="mt-3 block text-xs font-medium text-text-secondary">
            Outcome note (required to complete)
            <textarea value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} rows={2} maxLength={1000} className={inputClass} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void completeReview(review.id)}
              disabled={saving || !outcomeNote.trim() || !data.live}
              className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Complete review"}
            </button>
            <button
              type="button"
              onClick={() => void removeDraft(review.id)}
              disabled={saving}
              className="rounded-xl border border-[rgba(0,0,0,0.10)] bg-bg-card px-4 py-2.5 text-xs font-semibold text-text-secondary disabled:opacity-50"
            >
              Remove draft
            </button>
          </div>
          {!data.live && (
            <p className="mt-2 text-[11px] text-amber-500">Completing needs a locked Month 1 baseline.</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-text-secondary">
              Review date (defaults to today)
              <input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} className={inputClass} />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => void createDraft()} disabled={saving} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                {saving ? "Creating..." : "Create review draft"}
              </button>
            </div>
          </div>
          {data.liveBlockedReason && (
            <p className="mt-2 text-[11px] text-text-muted">{data.liveBlockedReason}.</p>
          )}
        </div>
      )}
    </section>
  );
}
