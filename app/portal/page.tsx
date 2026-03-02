"use client";

import Link from "next/link";
import { useState } from "react";

const shiftAreas = [
  { key: "I", title: "Identity & Values", progress: 72, status: "On Track", lastActivity: "Values alignment exercise completed", color: "#10B981" },
  { key: "M", title: "Mind & Emotional Control", progress: 58, status: "In Progress", lastActivity: "Journaling streak: 12 days", color: "#10B981" },
  { key: "W", title: "Mission & Work Output", progress: 45, status: "In Progress", lastActivity: "Work-life boundary audit done", color: "#10B981" },
  { key: "S", title: "Self-Worth & Money", progress: 35, status: "Starting", lastActivity: "Investment mindset module unlocked", color: "#F59E0B" },
  { key: "H", title: "Home Team", progress: 60, status: "On Track", lastActivity: "Family time audit submitted", color: "#10B981" },
  { key: "L", title: "Leadership & Social", progress: 28, status: "Starting", lastActivity: "Social standards worksheet pending", color: "#F59E0B" },
  { key: "B", title: "Body & Recovery", progress: 65, status: "On Track", lastActivity: "Training plan week 8 complete", color: "#10B981" },
];

const checkins = [
  { date: "Fri 28 Feb", rating: 8, note: "Strong week. Hit all 4 training sessions. Sleep averaged 7.2 hours. One business dinner but managed it well.", mood: "Focused" },
  { date: "Fri 21 Feb", rating: 7, note: "Travel week - kept to the travel protocol. Missed one session but walked 12k steps daily. Energy dipped Thursday.", mood: "Steady" },
  { date: "Fri 14 Feb", rating: 9, note: "Best week in months. Nailed every session, food was dialled in, even got the Sunday meal prep done. Felt like myself again.", mood: "Driven" },
  { date: "Fri 7 Feb", rating: 6, note: "Tough week at work. Stress eating crept back in midweek. Got back on track Thursday. Need to watch the pattern.", mood: "Recovering" },
];

const modules = [
  { title: "The SHIFT Foundation", lessons: 6, completed: 6, locked: false },
  { title: "Values Alignment Deep Dive", lessons: 4, completed: 4, locked: false },
  { title: "Building Your Operating System", lessons: 5, completed: 3, locked: false },
  { title: "Stress Protocols & Recovery", lessons: 4, completed: 1, locked: false },
  { title: "The Travel & Chaos Framework", lessons: 3, completed: 0, locked: false },
  { title: "Advanced Self-Sabotage Removal", lessons: 5, completed: 0, locked: true },
  { title: "Leadership & Legacy", lessons: 4, completed: 0, locked: true },
];

const upcomingCalls = [
  { date: "Thu 6 Mar", time: "6:00 PM", type: "1-to-1 Coaching Call", platform: "Zoom" },
  { date: "Thu 20 Mar", time: "6:00 PM", type: "1-to-1 Coaching Call", platform: "Zoom" },
];

type Tab = "dashboard" | "shift" | "modules" | "checkins" | "calls";

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const overallProgress = Math.round(shiftAreas.reduce((acc, a) => acc + a.progress, 0) / shiftAreas.length);
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons, 0);
  const completedLessons = modules.reduce((acc, m) => acc + m.completed, 0);
  const avgRating = (checkins.reduce((acc, c) => acc + c.rating, 0) / checkins.length).toFixed(1);

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "shift", label: "SHIFT Areas" },
    { key: "modules", label: "Modules" },
    { key: "checkins", label: "Check-Ins" },
    { key: "calls", label: "Coaching Calls" },
  ];

  return (
    <main className="min-h-screen pt-[72px] bg-bg-primary">
      {/* Portal Header */}
      <div className="bg-bg-secondary border-b border-[rgba(255,255,255,0.04)] px-8 py-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-[0.72rem] font-semibold text-accent uppercase tracking-[2px] mb-1">SHIFT Client Portal</div>
            <h1 className="font-heading text-xl font-bold">Welcome back, James.</h1>
            <p className="text-text-muted text-[0.82rem] mt-1">Month 3 of 6 - SHIFT VIP Programme</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[0.72rem] text-text-muted uppercase tracking-[1px]">Next Call</div>
              <div className="text-[0.88rem] font-semibold text-accent-bright">Thu 6 Mar, 6pm</div>
            </div>
            <div className="w-10 h-10 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-full flex items-center justify-center font-bold text-accent-bright text-sm">JD</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-bg-secondary border-b border-[rgba(255,255,255,0.04)] px-8">
        <div className="max-w-[1200px] mx-auto flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-[0.85rem] font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-accent text-accent-bright"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-10">

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Overall Progress", value: `${overallProgress}%`, sub: "Across all 7 areas" },
                { label: "Lessons Completed", value: `${completedLessons}/${totalLessons}`, sub: `${Math.round(completedLessons/totalLessons*100)}% through content` },
                { label: "Avg Weekly Rating", value: avgRating, sub: "Last 4 weeks" },
                { label: "Check-In Streak", value: "4", sub: "Consecutive weeks" },
              ].map((card, i) => (
                <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6 hover:border-[rgba(16,185,129,0.15)] transition-all duration-300">
                  <div className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-[1.5px] mb-2">{card.label}</div>
                  <div className="font-heading text-[2rem] font-black gradient-text">{card.value}</div>
                  <div className="text-[0.78rem] text-text-muted mt-1">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* SHIFT Overview */}
            <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6">
              <h2 className="font-heading text-lg font-bold mb-5">SHIFT Progress Overview</h2>
              <div className="space-y-4">
                {shiftAreas.map((area) => (
                  <div key={area.key} className="flex items-center gap-4">
                    <div className="w-10 h-10 min-w-[40px] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.12)] rounded-[10px] flex items-center justify-center font-heading font-black text-accent-bright text-sm">{area.key}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[0.88rem] font-medium">{area.title}</span>
                        <span className="text-[0.78rem] text-accent-bright font-bold">{area.progress}%</span>
                      </div>
                      <div className="h-2 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.04)]">
                        <div className="h-full gradient-accent rounded-full transition-all duration-700" style={{ width: `${area.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Check-In + Upcoming */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6">
                <h2 className="font-heading text-lg font-bold mb-4">Latest Check-In</h2>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-full flex items-center justify-center font-heading text-2xl font-black text-accent-bright">{checkins[0].rating}</div>
                  <div>
                    <div className="text-[0.88rem] font-semibold">{checkins[0].date}</div>
                    <div className="text-[0.78rem] text-text-muted">Mood: {checkins[0].mood}</div>
                  </div>
                </div>
                <p className="text-[0.88rem] text-text-secondary leading-[1.7] border-l-2 border-accent pl-4">{checkins[0].note}</p>
              </div>

              <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6">
                <h2 className="font-heading text-lg font-bold mb-4">Upcoming</h2>
                <div className="space-y-3">
                  {upcomingCalls.map((call, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-[rgba(16,185,129,0.03)] border border-[rgba(16,185,129,0.08)] rounded-xl">
                      <div className="w-10 h-10 bg-[rgba(16,185,129,0.1)] rounded-[10px] flex items-center justify-center">
                        <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-[0.88rem] font-semibold">{call.type}</div>
                        <div className="text-[0.78rem] text-text-muted">{call.date} at {call.time} - {call.platform}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 p-3 bg-[rgba(245,158,11,0.03)] border border-[rgba(245,158,11,0.08)] rounded-xl">
                    <div className="w-10 h-10 bg-[rgba(245,158,11,0.1)] rounded-[10px] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-[0.88rem] font-semibold">Weekly Check-In Due</div>
                      <div className="text-[0.78rem] text-text-muted">Friday - Submit before 8pm</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SHIFT AREAS TAB */}
        {activeTab === "shift" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shiftAreas.map((area) => (
              <div key={area.key} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6 hover:border-[rgba(16,185,129,0.15)] transition-all duration-300">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.12)] rounded-[12px] flex items-center justify-center font-heading font-black text-accent-bright text-lg">{area.key}</div>
                  <div className="flex-1">
                    <h3 className="font-heading text-[1.05rem] font-bold">{area.title}</h3>
                    <span className={`inline-block mt-1 text-[0.72rem] font-semibold px-2.5 py-0.5 rounded-full ${
                      area.status === "On Track" ? "bg-[rgba(16,185,129,0.1)] text-accent-bright" : "bg-[rgba(245,158,11,0.1)] text-[#F59E0B]"
                    }`}>{area.status}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-heading text-2xl font-black gradient-text">{area.progress}%</div>
                  </div>
                </div>
                <div className="h-2.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.04)] mb-3">
                  <div className="h-full gradient-accent rounded-full transition-all duration-700" style={{ width: `${area.progress}%` }} />
                </div>
                <p className="text-[0.82rem] text-text-muted">{area.lastActivity}</p>
              </div>
            ))}
          </div>
        )}

        {/* MODULES TAB */}
        {activeTab === "modules" && (
          <div className="space-y-4">
            {modules.map((mod, i) => (
              <div key={i} className={`bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6 transition-all duration-300 ${mod.locked ? "opacity-50" : "hover:border-[rgba(16,185,129,0.15)]"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 min-w-[40px] rounded-[10px] flex items-center justify-center font-heading font-bold text-sm ${
                    mod.completed === mod.lessons
                      ? "bg-[rgba(16,185,129,0.15)] text-accent-bright border border-[rgba(16,185,129,0.3)]"
                      : mod.locked
                      ? "bg-[rgba(255,255,255,0.03)] text-text-muted border border-[rgba(255,255,255,0.04)]"
                      : "bg-[rgba(16,185,129,0.08)] text-accent-light border border-[rgba(16,185,129,0.12)]"
                  }`}>
                    {mod.completed === mod.lessons ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : mod.locked ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[0.95rem] font-semibold">{mod.title}</h3>
                    <p className="text-[0.78rem] text-text-muted">{mod.completed} of {mod.lessons} lessons completed</p>
                  </div>
                  <div className="hidden sm:block w-32">
                    <div className="h-2 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.04)]">
                      <div className="h-full gradient-accent rounded-full" style={{ width: `${(mod.completed / mod.lessons) * 100}%` }} />
                    </div>
                  </div>
                  {!mod.locked && (
                    <button className="text-[0.82rem] font-semibold text-accent hover:text-accent-bright transition-colors">
                      {mod.completed === mod.lessons ? "Review" : mod.completed > 0 ? "Continue" : "Start"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CHECK-INS TAB */}
        {activeTab === "checkins" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-lg font-bold">Weekly Check-Ins</h2>
              <button className="bg-accent text-white px-5 py-2.5 rounded-lg font-semibold text-[0.85rem] transition-all duration-300 hover:bg-accent-light hover:-translate-y-px hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                Submit This Week
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-2">
              {checkins.map((c, i) => (
                <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[12px] p-4 text-center">
                  <div className="text-[0.72rem] text-text-muted mb-1">{c.date}</div>
                  <div className={`font-heading text-2xl font-black ${c.rating >= 8 ? "text-accent-bright" : c.rating >= 6 ? "text-[#F59E0B]" : "text-[#e05555]"}`}>{c.rating}/10</div>
                  <div className="text-[0.72rem] text-text-muted mt-1">{c.mood}</div>
                </div>
              ))}
            </div>
            {checkins.map((c, i) => (
              <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-heading text-lg font-black ${c.rating >= 8 ? "bg-[rgba(16,185,129,0.1)] text-accent-bright" : c.rating >= 6 ? "bg-[rgba(245,158,11,0.1)] text-[#F59E0B]" : "bg-[rgba(220,80,80,0.1)] text-[#e05555]"}`}>{c.rating}</div>
                  <div>
                    <div className="text-[0.88rem] font-semibold">{c.date}</div>
                    <div className="text-[0.72rem] text-text-muted">Mood: {c.mood}</div>
                  </div>
                </div>
                <p className="text-[0.88rem] text-text-secondary leading-[1.7] border-l-2 border-[rgba(255,255,255,0.06)] pl-4">{c.note}</p>
              </div>
            ))}
          </div>
        )}

        {/* COACHING CALLS TAB */}
        {activeTab === "calls" && (
          <div className="space-y-6">
            <h2 className="font-heading text-lg font-bold">Coaching Calls</h2>

            <div className="bg-bg-card border border-[rgba(16,185,129,0.15)] rounded-[16px] p-6">
              <div className="text-[0.72rem] font-semibold text-accent uppercase tracking-[2px] mb-3">Next Call</div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="font-heading text-xl font-bold">Thursday 6th March</div>
                  <div className="text-text-secondary">6:00 PM - 1-to-1 Coaching Call via Zoom</div>
                </div>
                <button className="ml-auto bg-accent text-white px-6 py-3 rounded-lg font-semibold text-[0.88rem] transition-all duration-300 hover:bg-accent-light hover:-translate-y-px">
                  Join Call
                </button>
              </div>
            </div>

            <h3 className="font-heading text-base font-bold text-text-secondary mt-8">Upcoming</h3>
            {upcomingCalls.slice(1).map((call, i) => (
              <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6 flex items-center gap-4">
                <div className="w-10 h-10 bg-[rgba(16,185,129,0.08)] rounded-[10px] flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-light" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <div className="text-[0.88rem] font-semibold">{call.type}</div>
                  <div className="text-[0.78rem] text-text-muted">{call.date} at {call.time} - {call.platform}</div>
                </div>
              </div>
            ))}

            <h3 className="font-heading text-base font-bold text-text-secondary mt-8">Past Calls</h3>
            {[
              { date: "Thu 20 Feb", notes: "Reviewed travel protocol. Adjusted training split for busy weeks. Set new target for body composition check-in." },
              { date: "Thu 6 Feb", notes: "Values alignment check-in. Identified work-health conflict pattern. Built new morning routine framework." },
              { date: "Thu 23 Jan", notes: "SHIFT kickoff call. Set 6-month targets. Completed initial assessment across all 7 areas." },
            ].map((call, i) => (
              <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-[16px] p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-[rgba(255,255,255,0.03)] rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-[0.88rem] font-semibold">{call.date}</span>
                  <span className="text-[0.72rem] text-text-muted bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded">Completed</span>
                </div>
                <p className="text-[0.82rem] text-text-secondary leading-[1.7] ml-11">{call.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Demo Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-[rgba(16,185,129,0.1)] border-t border-[rgba(16,185,129,0.2)] backdrop-blur-[20px] px-8 py-3 z-50">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="text-[0.85rem]">
            <span className="font-semibold text-accent-bright">Portal Demo</span>
            <span className="text-text-secondary ml-2">- This is a preview of what SHIFT clients see when they log in.</span>
          </div>
          <Link href="/" className="text-[0.82rem] font-semibold text-accent hover:text-accent-bright transition-colors">
            Back to site
          </Link>
        </div>
      </div>
    </main>
  );
}
