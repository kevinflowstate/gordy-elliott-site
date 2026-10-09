"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardWeightHistory } from "@/lib/admin-dashboard";
import DashboardDetail from "./DashboardDetail";

export default function DashboardWeightCard({ history, startWeight }: { history: ReturnType<typeof dashboardWeightHistory>; startWeight: number | null }) {
  const [open, setOpen] = useState(false);
  const latest = history.at(-1);
  const previous = history.at(-2);
  const formatWeight = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  const change = latest && previous ? latest.value - previous.value : null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mb-3 w-full rounded-2xl border border-black/10 bg-bg-card p-4 text-left transition-colors hover:border-[#E040D0]/40 focus-visible:outline-2 focus-visible:outline-accent-bright">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Weight Tracker</span>
        <span className="text-xs font-semibold text-accent-bright">View history →</span>
      </div>
      <div className="mt-3 text-2xl font-heading font-bold text-text-primary">{latest ? `${formatWeight(latest.value)} kg` : "No weight logged"}</div>
      <p className="mt-1 text-xs text-text-muted">{latest ? `Latest: ${latest.date}` : "Check-in weights will appear here."}</p>
      {change !== null && <p className="mt-2 text-xs text-text-secondary">{change > 0 ? "+" : ""}{change.toFixed(1)} kg since previous check-in</p>}
      {latest && startWeight !== null && <p className="mt-1 text-xs text-text-muted">Start: {formatWeight(startWeight)} kg · change {latest.value - startWeight > 0 ? "+" : ""}{(latest.value - startWeight).toFixed(1)} kg</p>}
    </button>
    {open && <DashboardDetail title="Weight history" onClose={() => setOpen(false)}>
      {history.length ? <>
        <p className="mb-5 text-sm text-text-secondary">Recorded check-in weights · kg</p>
        {history.length > 1 ? <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 256 }}>
            <LineChart data={history} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <XAxis dataKey="date" minTickGap={32} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis width={45} domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--color-bg-card)", borderRadius: 12, border: "1px solid rgba(0,0,0,.1)" }} formatter={(value) => [`${formatWeight(Number(value))} kg`, "Weight"]} />
              <Line dataKey="value" type="linear" stroke="#E040D0" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="rounded-xl bg-bg-primary p-4 text-sm text-text-secondary">One weight recorded. A trend will appear after the next check-in.</p>}
        <div className="mt-5 divide-y divide-black/5">{[...history].reverse().map((point) => <div key={point.id} className="flex items-center justify-between py-3 text-sm"><span className="text-text-secondary">{point.date}</span><strong>{formatWeight(point.value)} kg</strong></div>)}</div>
      </> : <p className="text-sm text-text-secondary">No check-in weight records yet.</p>}
    </DashboardDetail>}
  </>;
}
