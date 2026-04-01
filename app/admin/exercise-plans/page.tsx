"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ExerciseTemplate } from "@/lib/types";
import ExerciseTemplateBuilder from "@/components/admin/ExerciseTemplateBuilder";

const CATEGORIES = ["strength", "hypertrophy", "conditioning", "flexibility", "general"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, string> = {
  strength: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  hypertrophy: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  conditioning: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  flexibility: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  general: "bg-accent/10 text-accent-bright border-accent/20",
};

export default function ExercisePlansPage() {
  const [templates, setTemplates] = useState<ExerciseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Builder & preview state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExerciseTemplate | undefined>(undefined);
  const [viewingTemplate, setViewingTemplate] = useState<ExerciseTemplate | null>(null);

  async function loadTemplates() {
    try {
      const res = await fetch("/api/admin/exercise-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTemplates(); }, []);

  async function handleSave(template: ExerciseTemplate) {
    const res = await fetch("/api/admin/exercise-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to save template");
      return;
    }

    setBuilderOpen(false);
    setEditingTemplate(undefined);
    await loadTemplates();
  }

  async function handleDelete(templateId: string, templateName: string) {
    if (!confirm(`Delete "${templateName}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/exercise-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: templateId }),
    });
    if (res.ok) {
      await loadTemplates();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to delete template");
    }
  }

  function openCreate() {
    setEditingTemplate(undefined);
    setBuilderOpen(true);
  }

  function openEdit(template: ExerciseTemplate) {
    setEditingTemplate(template);
    setBuilderOpen(true);
  }

  const allTags = Array.from(new Set(templates.flatMap((t) => t.tags || []))).sort();

  const filtered = templates.filter((t) => {
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !tagFilter || (t.tags || []).includes(tagFilter);
    return matchesCategory && matchesSearch && matchesTag;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl p-5">
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-5 w-2/3 mb-3" />
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-3 w-full mb-2" />
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Training Plans</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {templates.length} template{templates.length !== 1 ? "s" : ""} in library
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/exercise-library"
            className="px-4 py-2.5 border border-[rgba(0,0,0,0.08)] text-text-secondary hover:text-text-primary hover:bg-[rgba(0,0,0,0.03)] rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 no-underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Exercise Library
          </Link>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-accent-bright text-black rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-1 bg-bg-card/50 rounded-xl p-1 flex-wrap">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                categoryFilter === "all"
                  ? "bg-accent/10 text-accent-bright border border-accent/20"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              All ({templates.length})
            </button>
            {CATEGORIES.map((c) => {
              const count = templates.filter((t) => t.category === c).length;
              if (count === 0) return null;
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer capitalize ${
                    categoryFilter === c
                      ? "bg-accent/10 text-accent-bright border border-accent/20"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Tags:</span>
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-bg-card/50 text-text-muted hover:text-text-secondary border border-[rgba(0,0,0,0.06)] cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border cursor-pointer transition-all ${
                  tagFilter === tag
                    ? "bg-accent/15 text-accent-bright border-accent/30"
                    : "bg-bg-card/50 text-white/40 border-white/[0.06] hover:text-accent-bright hover:border-accent/20"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="bg-gradient-to-br from-[#1a1a1a] via-[#222222] to-[#1a1a1a] border border-accent/20 rounded-2xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-white/50 text-sm mb-4">
              {search || categoryFilter !== "all" ? "No training plans match your filters." : "No training plans yet."}
            </p>
            {search || categoryFilter !== "all" ? (
              <button
                onClick={() => { setSearch(""); setCategoryFilter("all"); setTagFilter(null); }}
                className="text-xs text-accent-bright hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-accent-bright text-black rounded-xl text-sm font-semibold cursor-pointer"
              >
                Create your first template
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onView={() => setViewingTemplate(template)}
              onEdit={() => openEdit(template)}
              onDelete={() => handleDelete(template.id, template.name)}
            />
          ))}
        </div>
      )}

      {/* Template Preview */}
      {viewingTemplate && (
        <TemplatePreview
          template={viewingTemplate}
          onEdit={() => { setViewingTemplate(null); openEdit(viewingTemplate); }}
          onClose={() => setViewingTemplate(null)}
        />
      )}

      {/* Builder */}
      {builderOpen && (
        <ExerciseTemplateBuilder
          existingTemplate={editingTemplate}
          onSave={handleSave}
          onCancel={() => { setBuilderOpen(false); setEditingTemplate(undefined); }}
        />
      )}
    </>
  );
}

interface TemplateCardProps {
  template: ExerciseTemplate;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onView, onEdit, onDelete }: TemplateCardProps) {
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general;
  const totalExercises = template.sessions.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] via-[#222222] to-[#1a1a1a] border border-accent/20 rounded-2xl overflow-hidden hover:border-accent/40 hover:shadow-[0_8px_32px_rgba(226,184,48,0.12)] transition-all group">
      {/* Gold top accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />

      {/* Card body - clickable to preview */}
      <button
        type="button"
        onClick={onView}
        className="w-full text-left p-5 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-accent-bright transition-colors">
            {template.name}
          </h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 capitalize ${categoryColor}`}>
            {template.category}
          </span>
        </div>

        {template.description && (
          <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">{template.description}</p>
        )}

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-accent/15 text-accent-bright border border-accent/25"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] text-white/40">
          {template.duration_weeks && (
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {template.duration_weeks}w
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {template.sessions.length} session{template.sessions.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Card footer actions */}
      <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-bright hover:text-white border border-accent/20 hover:border-accent/40 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/40 hover:text-red-400 border border-white/[0.06] hover:border-red-400/20 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

// Read-only preview of a template
interface TemplatePreviewProps {
  template: ExerciseTemplate;
  onEdit: () => void;
  onClose: () => void;
}

function TemplatePreview({ template, onEdit, onClose }: TemplatePreviewProps) {
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general;
  const totalExercises = template.sessions.reduce((sum, s) => sum + s.items.filter(i => i.exercise_id !== "__section__").length, 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-bg-primary border-l border-[rgba(0,0,0,0.08)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-[rgba(0,0,0,0.06)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-text-primary">{template.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary border border-[rgba(0,0,0,0.08)] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Template
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary border border-[rgba(0,0,0,0.08)] rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Template info */}
          <div className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                {template.description && (
                  <p className="text-sm text-text-secondary mb-3">{template.description}</p>
                )}
                <div className="flex items-center gap-3 text-[13px] text-text-muted">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border capitalize ${categoryColor}`}>
                    {template.category}
                  </span>
                  {template.duration_weeks && <span>{template.duration_weeks} weeks</span>}
                  <span>{template.sessions.length} session{template.sessions.length !== 1 ? "s" : ""}</span>
                  <span>{totalExercises} exercise{totalExercises !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sessions */}
          {template.sessions.map((session) => {
            const exerciseItems = session.items.filter(i => i.exercise_id !== "__section__");
            return (
              <div key={session.id} className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
                {/* Session header */}
                <div className="px-5 py-3 border-b border-[rgba(0,0,0,0.04)] flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-bright flex-shrink-0">
                    {session.day_number}
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">{session.name}</h3>
                  <span className="text-[11px] text-text-muted ml-auto">{exerciseItems.length} exercises</span>
                </div>

                {session.notes && (
                  <div className="px-5 py-2 bg-accent-bright/5 text-[13px] text-text-secondary italic border-b border-[rgba(0,0,0,0.04)]">
                    {session.notes}
                  </div>
                )}

                {/* Exercises */}
                <div className="divide-y divide-[rgba(0,0,0,0.03)]">
                  {session.items.map((item) => {
                    // Section divider
                    if (item.exercise_id === "__section__") {
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-5 pt-4 pb-1">
                          <svg className="w-4 h-4 text-accent-bright flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16" />
                          </svg>
                          <span className="text-[12px] font-bold text-accent-bright uppercase tracking-wider">
                            {item.section_label || "Section"}
                          </span>
                          <div className="flex-1 border-t border-accent-bright/20" />
                        </div>
                      );
                    }

                    const inSuperset = !!item.superset_group;
                    return (
                      <div
                        key={item.id}
                        className={`px-5 py-3 flex items-start gap-3 ${inSuperset ? "border-l-2 border-accent-bright ml-4" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[13px] font-medium text-text-primary">
                                {item.exercise?.name || "Unknown"}
                              </h4>
                              {inSuperset && (
                                <span className="text-[9px] font-bold text-accent-bright uppercase bg-accent-bright/10 px-1.5 py-0.5 rounded">
                                  SS
                                </span>
                              )}
                              {item.exercise && (
                                <button
                                  onClick={() => {
                                    const url = item.exercise!.video_url || `https://musclewiki.com/exercises?search=${encodeURIComponent(item.exercise!.name)}`;
                                    window.open(url, '_blank', 'noopener');
                                  }}
                                  className="text-[11px] text-accent-bright hover:underline flex-shrink-0 inline-flex items-center gap-0.5"
                                  title="View exercise demo"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Demo
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <span className="text-[13px] px-2 py-0.5 rounded-md bg-accent-bright/10 text-accent-bright font-medium">
                                {item.sets} x {item.reps}
                              </span>
                              {item.rest_seconds && (
                                <span className="text-[13px] px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.04)] text-text-secondary">
                                  {item.rest_seconds}s rest
                                </span>
                              )}
                              {item.tempo && (
                                <span className="text-[13px] px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.04)] text-text-secondary">
                                  {item.tempo}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-[13px] text-accent-bright/70 mt-1 italic">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
