"use client";
import { useEffect, useState } from "react";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  supportTicketMatchesFilter,
  type SupportTicket,
} from "@/lib/support-contract";
type Props = {
  initialTickets?: SupportTicket[];
  onSave?: (ticket: SupportTicket) => Promise<SupportTicket>;
};
export default function SupportQueue({ initialTickets, onSave }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets || []);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(!initialTickets);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("Open");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(initialTickets?.length || 0);
  useEffect(() => {
    if (initialTickets) setTickets(initialTickets);
  }, [initialTickets]);
  async function load(append = false) {
    setLoading(true);
    setError("");
    try {
      const nextPage = append ? page + 1 : 0;
      const res = await fetch(
        `/api/admin/support?status=${encodeURIComponent(filter)}&page=${nextPage}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTickets((prev) =>
        append
          ? [
              ...prev,
              ...data.tickets.filter(
                (row: SupportTicket) =>
                  !prev.some((existing) => existing.id === row.id),
              ),
            ]
          : data.tickets,
      );
      setPage(nextPage);
      setHasMore(data.hasMore);
      setTotal(data.total);
      if (!append) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Queue unavailable.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!initialTickets) void load();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let ticket: SupportTicket;
      if (onSave) ticket = await onSave(selected);
      else {
        const res = await fetch("/api/admin/support", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selected),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        ticket = { ...data.ticket, image_url: selected.image_url };
      }
      setTickets((prev) =>
        prev.map((row) => (row.id === ticket.id ? ticket : row)),
      );
      // Refresh from page zero after every persisted update. Status changes can
      // move a retained editor's report in or out of this filtered queue.
      if (!initialTickets) await load();
      setSelected(ticket);
      setMessage("Report updated. No client message has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }
  const visible = tickets.filter((ticket) =>
    supportTicketMatchesFilter(ticket.status, filter),
  );
  const control =
    "mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-[#17171d] px-3 py-2 text-base text-white focus:border-[#f06be3] focus:outline-none";
  return (
    <div className="text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">App support</h1>
          <p className="mt-2 text-sm leading-6 text-[#b9bac4]">
            Technical reports sent directly by clients. Assign an owner and keep
            the next action clear.
          </p>
        </div>
        {!initialTickets && (
          <button
            onClick={() => void load()}
            disabled={loading || saving}
            className="min-h-11 rounded-lg border border-white/20 px-4 text-sm"
          >
            Refresh queue
          </button>
        )}
      </div>
      <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-semibold">
          Show
          <select
            value={filter}
            disabled={saving || loading}
            onChange={(event) => setFilter(event.target.value)}
            className={control}
          >
            {["Open", "All", ...SUPPORT_STATUSES].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <p className="text-sm text-[#b9bac4]">
          {visible.length} reports shown{!initialTickets ? ` of ${total}` : ""}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-400/10 p-4 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-400/10 p-4 text-sm text-emerald-200"
        >
          {message}
        </p>
      )}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          {loading ? (
            <p className="py-8 text-[#b9bac4]">Loading reports…</p>
          ) : visible.length === 0 ? (
            <p className="rounded-xl border border-white/15 p-6 text-[#b9bac4]">
              No reports in this view.
            </p>
          ) : (
            visible.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => {
                  setSelected({ ...ticket });
                  setMessage("");
                  setError("");
                }}
                disabled={saving}
                className={`w-full min-w-0 rounded-xl border p-4 text-left ${selected?.id === ticket.id ? "border-[#f06be3] bg-[#f06be3]/5" : "border-white/15 bg-[#121217]"}`}
              >
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-mono text-[#f06be3]">
                    {ticket.reference}
                  </span>
                  <span>{ticket.status}</span>
                  <span
                    className={
                      ticket.priority === "Urgent" || ticket.priority === "High"
                        ? "text-amber-200"
                        : "text-[#b9bac4]"
                    }
                  >
                    {ticket.priority}
                  </span>
                </div>
                <h2 className="mt-3 font-semibold">{ticket.area}</h2>
                <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[#c3c4cd]">
                  {ticket.description}
                </p>
                <p className="mt-3 break-words text-xs leading-5 text-[#b9bac4]">
                  {ticket.name} ·{" "}
                  {new Date(ticket.created_at).toLocaleString("en-GB")}
                  <br />
                  Owner: {ticket.owner || "Unassigned"}
                </p>
              </button>
            ))
          )}
          {hasMore && !initialTickets && (
            <button
              onClick={() => void load(true)}
              disabled={loading || saving}
              className="min-h-11 w-full rounded-lg border border-white/20 px-4 text-sm"
            >
              {loading ? "Loading…" : "Load more reports"}
            </button>
          )}
        </div>
        {selected ? (
          <section className="min-w-0 rounded-xl border border-white/15 bg-[#121217] p-5 sm:p-6">
            <p className="break-all font-mono text-sm text-[#f06be3]">
              {selected.reference}
            </p>
            <h2 className="mt-3 font-heading text-xl font-bold">
              {selected.area}
            </h2>
            <p className="mt-2 text-sm text-[#b9bac4]">{selected.impact}</p>
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7">
              {selected.description}
            </p>
            {selected.expected && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-[#b9bac4]">
                  Expected
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                  {selected.expected}
                </p>
              </div>
            )}
            <dl className="mt-5 space-y-2 break-words text-sm leading-6 text-[#b9bac4]">
              <div>
                <dt className="inline font-semibold">Contact: </dt>
                <dd className="inline">
                  {selected.name} · {selected.email} (submitted, not verified)
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Device: </dt>
                <dd className="inline">{selected.device || "Not supplied"}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Page: </dt>
                <dd className="inline">{selected.page || "Not supplied"}</dd>
              </div>
            </dl>
            {selected.image_url && (
              <a
                href={selected.image_url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block text-sm text-[#f06be3] underline"
              >
                Open private screenshot (link expires)
              </a>
            )}
            <fieldset disabled={saving}>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Status
                  <select
                    value={selected.status}
                    onChange={(e) =>
                      setSelected({ ...selected, status: e.target.value })
                    }
                    className={control}
                  >
                    {SUPPORT_STATUSES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Priority
                  <select
                    value={selected.priority}
                    onChange={(e) =>
                      setSelected({ ...selected, priority: e.target.value })
                    }
                    className={control}
                  >
                    {SUPPORT_PRIORITIES.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold">
                Owner
                <input
                  value={selected.owner}
                  onChange={(e) =>
                    setSelected({ ...selected, owner: e.target.value })
                  }
                  maxLength={100}
                  placeholder="Named Flowstate developer"
                  className={control}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Internal notes / next action
                <textarea
                  value={selected.internal_notes}
                  onChange={(e) =>
                    setSelected({ ...selected, internal_notes: e.target.value })
                  }
                  maxLength={8000}
                  rows={4}
                  className={control}
                />
                <span className="mt-1 block text-xs font-normal text-[#b9bac4]">
                  Private to authorised admins. Never sent to the client.
                </span>
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Resolution / retest steps
                <textarea
                  value={selected.resolution}
                  onChange={(e) =>
                    setSelected({ ...selected, resolution: e.target.value })
                  }
                  maxLength={2000}
                  rows={3}
                  className={control}
                />
              </label>
              <button
                onClick={save}
                disabled={saving}
                className="mt-5 min-h-12 rounded-lg bg-[#e040d0] px-5 font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save report"}
              </button>
            </fieldset>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm leading-6 text-[#b9bac4]">
            Choose a report to assign, investigate or record a fix.
          </p>
        )}
      </div>
    </div>
  );
}
