"use client";

import { useEffect, useState } from "react";
import type { ClientExercisePlan } from "@/lib/types";

export default function PortalExercisePlanPage() {
  const [plan, setPlan] = useState<ClientExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/exercise-plan")
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        // Auto-expand first session
        if (data.plan?.sessions?.length > 0) {
          setExpandedSession(data.plan.sessions[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-xl w-48" />
          <div className="h-64 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-4">My Exercise Plan</h1>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <p className="text-text-secondary text-lg">No exercise plan assigned yet.</p>
          <p className="text-text-secondary/60 mt-2">Your coach will set one up for you soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
        {plan.description && (
          <p className="text-text-secondary mt-1">{plan.description}</p>
        )}
        <div className="flex gap-3 mt-3">
          <span className="text-[13px] px-3 py-1 rounded-full bg-accent-bright/10 text-accent-bright font-medium">
            {plan.sessions.length} {plan.sessions.length === 1 ? "session" : "sessions"}
          </span>
          {plan.start_date && (
            <span className="text-[13px] px-3 py-1 rounded-full bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary">
              Started {new Date(plan.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {plan.sessions.map((session) => {
          const isExpanded = expandedSession === session.id;
          return (
            <div
              key={session.id}
              className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden"
            >
              {/* Session header */}
              <button
                onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-accent-bright/10 text-accent-bright font-bold text-[13px] flex items-center justify-center">
                    {session.day_number}
                  </span>
                  <div>
                    <h3 className="font-semibold text-text-primary">{session.name}</h3>
                    <p className="text-[13px] text-text-secondary">
                      {session.items.length} {session.items.length === 1 ? "exercise" : "exercises"}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Exercise list */}
              {isExpanded && (
                <div className="border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                  {session.notes && (
                    <div className="px-4 py-3 bg-accent-bright/5 text-[13px] text-text-secondary italic">
                      {session.notes}
                    </div>
                  )}
                  {session.items.map((item, idx) => {
                    const exercise = item.exercise;
                    return (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-start gap-3 ${
                          idx < session.items.length - 1
                            ? "border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]"
                            : ""
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary text-[13px] font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-text-primary">
                              {exercise?.name || "Unknown Exercise"}
                            </h4>
                            <div className="flex gap-2 flex-shrink-0">
                              <span className="text-[13px] px-2 py-0.5 rounded-md bg-accent-bright/10 text-accent-bright font-medium">
                                {item.sets} x {item.reps}
                              </span>
                              {item.rest_seconds && (
                                <span className="text-[13px] px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary">
                                  {item.rest_seconds}s rest
                                </span>
                              )}
                            </div>
                          </div>
                          {item.tempo && (
                            <p className="text-[13px] text-text-secondary mt-0.5">
                              Tempo: {item.tempo}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-[13px] text-accent-bright/80 mt-1 italic">
                              {item.notes}
                            </p>
                          )}
                          {exercise?.muscle_group && (
                            <span className="inline-block mt-1 text-[13px] px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.04)] text-text-secondary/70 capitalize">
                              {exercise.muscle_group}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {session.items.length === 0 && (
                    <div className="px-4 py-6 text-center text-text-secondary/60 text-[13px]">
                      No exercises in this session yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
