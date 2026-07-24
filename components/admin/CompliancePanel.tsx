"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  CALL_TYPE_LABELS,
  weekKeyForDateKey,
  weekKeyStartDateKey,
  type CallType,
  type FounderComplianceSummary,
} from "@/lib/founder-compliance";
import type { CallAttendanceRow, WhatsappHelpRow } from "@/lib/founder-compliance-server";

type ComplianceResponse = {
  summary: FounderComplianceSummary;
  attendance: CallAttendanceRow[];
  whatsapp: WhatsappHelpRow[];
};

function longDate(dateKey: string) {
  const parsed = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function weekLabel(weekKey: string) {
  const monday = weekKeyStartDateKey(weekKey);
  return monday ? `w/c ${longDate(monday)}` : weekKey;
}

export default function CompliancePanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [callDate, setCallDate] = useState("");
  const [callType, setCallType] = useState<CallType>("coaching_call");
  const [callAttended, setCallAttended] = useState("attended");
  const [callNote, setCallNote] = useState("");

  const [whatsappHelped, setWhatsappHelped] = useState("helped");
  const [whatsappNote, setWhatsappNote] = useState("");
  const [whatsappWeekDate, setWhatsappWeekDate] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/client-compliance?client_id=${clientId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Compliance records could not be loaded");
      setData(payload);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Compliance records could not be loaded", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordCall() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          record: "call",
          call_date: callDate,
          call_type: callType,
          attended: callAttended === "attended",
          note: callNote,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Call could not be recorded");
      toast("Call recorded");
      setCallDate("");
      setCallNote("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Call could not be recorded", "error");
    } finally {
      setSaving(false);
    }
  }

  async function recordWhatsappWeek() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          record: "whatsapp",
          // An earlier week can be recorded by picking any date inside it.
          week_key: whatsappWeekDate ? weekKeyForDateKey(whatsappWeekDate) : undefined,
          helped: whatsappHelped === "helped",
          note: whatsappNote,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Week could not be recorded");
      toast("WhatsApp week recorded");
      setWhatsappNote("");
      setWhatsappWeekDate("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Week could not be recorded", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record: "call" | "whatsapp", id: string) {
    if (!window.confirm("Remove this record?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/client-compliance?record=${record}&id=${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Record could not be removed");
      toast("Record removed");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Record could not be removed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl bg-bg-card" />;
  }
  if (!data) return null;

  const { summary } = data;
  const inputClass = "mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary";

  const checkinFact = summary.checkins.expected_weeks === 0
    ? "No full weeks yet"
    : `${summary.checkins.submitted_weeks} of ${summary.checkins.expected_weeks} weeks`;
  const callFact = summary.calls.recorded === 0
    ? "No calls recorded yet"
    : `Attended ${summary.calls.attended} of ${summary.calls.recorded}`;
  const whatsappFact = summary.whatsapp.weeks_recorded === 0
    ? "No weeks recorded yet"
    : `Helped ${summary.whatsapp.weeks_helped} of ${summary.whatsapp.weeks_recorded} recorded weeks`;

  return (
    <section className="mb-6 rounded-2xl border border-[#E040D0]/18 bg-bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Founder compliance</div>
          <h2 className="mt-1 font-heading text-lg font-bold text-text-primary">Check-ins, calls and WhatsApp</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Plain facts over the last {summary.window_weeks} full weeks. Nothing here is scored or graded - it records what happened.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Weekly check-ins</div>
          <div className="mt-1 text-sm font-bold text-text-primary">{checkinFact}</div>
          <div className="mt-1 text-[10px] text-text-muted">
            This week: {summary.checkins.current_week_submitted ? "submitted" : "not submitted yet"}
            {summary.checkins.start_date ? "" : " · no start date on file"}
          </div>
        </div>
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Calls</div>
          <div className="mt-1 text-sm font-bold text-text-primary">{callFact}</div>
          <div className="mt-1 text-[10px] text-text-muted">
            {summary.calls.recorded === 0
              ? "Recorded calls will show here"
              : `Coaching ${summary.calls.by_type.coaching_call.attended}/${summary.calls.by_type.coaching_call.recorded} · Strategy ${summary.calls.by_type.strategy_call.attended}/${summary.calls.by_type.strategy_call.recorded}`}
          </div>
        </div>
        <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">WhatsApp help</div>
          <div className="mt-1 text-sm font-bold text-text-primary">{whatsappFact}</div>
          <div className="mt-1 text-[10px] text-text-muted">
            This week: {summary.whatsapp.current_week_recorded
              ? summary.whatsapp.current_week_helped
                ? "helped"
                : "recorded, no help needed"
              : "not recorded yet"}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Record a call</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <label className="text-xs font-medium text-text-secondary">
            Date (defaults to today)
            <input type="date" value={callDate} onChange={(event) => setCallDate(event.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Type
            <select value={callType} onChange={(event) => setCallType(event.target.value as CallType)} className={inputClass}>
              <option value="coaching_call">{CALL_TYPE_LABELS.coaching_call}</option>
              <option value="strategy_call">{CALL_TYPE_LABELS.strategy_call}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Outcome
            <select value={callAttended} onChange={(event) => setCallAttended(event.target.value)} className={inputClass}>
              <option value="attended">Attended</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Note (optional)
            <input type="text" value={callNote} onChange={(event) => setCallNote(event.target.value)} maxLength={500} className={inputClass} />
          </label>
        </div>
        <div className="mt-3">
          <button type="button" onClick={() => void recordCall()} disabled={saving} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Record call"}
          </button>
        </div>
        {data.attendance.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {data.attendance.slice(0, 8).map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                <div className="text-xs text-text-primary">
                  <span className="font-semibold">{longDate(record.call_date)}</span>
                  <span className="mx-1.5 text-text-muted">·</span>
                  {CALL_TYPE_LABELS[record.call_type as CallType] || record.call_type}
                  <span className={`ml-1.5 font-semibold ${record.attended ? "text-emerald-500" : "text-amber-500"}`}>
                    {record.attended ? "Attended" : "Missed"}
                  </span>
                  {record.note && <span className="ml-1.5 text-text-muted">{record.note}</span>}
                </div>
                <button type="button" onClick={() => void removeRecord("call", record.id)} disabled={saving} className="text-[10px] font-semibold text-text-muted underline disabled:opacity-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          WhatsApp help - {weekLabel(summary.whatsapp.current_week_key)}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Gordy&apos;s own weekly record of whether he helped this client on WhatsApp. Saving the same week again updates it.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-text-secondary">
            This week
            <select value={whatsappHelped} onChange={(event) => setWhatsappHelped(event.target.value)} className={inputClass}>
              <option value="helped">Helped on WhatsApp</option>
              <option value="not_helped">No help needed</option>
            </select>
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Note (optional)
            <input type="text" value={whatsappNote} onChange={(event) => setWhatsappNote(event.target.value)} maxLength={500} className={inputClass} />
          </label>
          <label className="text-xs font-medium text-text-secondary">
            Earlier week (pick any date in it)
            <input type="date" value={whatsappWeekDate} onChange={(event) => setWhatsappWeekDate(event.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="mt-3">
          <button type="button" onClick={() => void recordWhatsappWeek()} disabled={saving} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save week"}
          </button>
        </div>
        {data.whatsapp.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {data.whatsapp.slice(0, 8).map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                <div className="text-xs text-text-primary">
                  <span className="font-semibold">{weekLabel(record.week_key)}</span>
                  <span className={`ml-1.5 font-semibold ${record.helped ? "text-emerald-500" : "text-text-muted"}`}>
                    {record.helped ? "Helped" : "No help needed"}
                  </span>
                  {record.note && <span className="ml-1.5 text-text-muted">{record.note}</span>}
                </div>
                <button type="button" onClick={() => void removeRecord("whatsapp", record.id)} disabled={saving} className="text-[10px] font-semibold text-text-muted underline disabled:opacity-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
