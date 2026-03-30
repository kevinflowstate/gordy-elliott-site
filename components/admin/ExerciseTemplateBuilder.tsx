"use client";

import { useState } from "react";
import type { ExerciseTemplate, ExerciseSession, ExerciseSessionItem, Exercise } from "@/lib/types";
import DndSortableList, { DragHandle } from "@/components/ui/DndSortableList";
import ExercisePicker from "./ExercisePicker";

interface ExerciseTemplateBuilderProps {
  existingTemplate?: ExerciseTemplate;
  onSave: (template: ExerciseTemplate) => void;
  onCancel: () => void;
}

function generateId() {
  return crypto.randomUUID();
}

const CATEGORIES = ["strength", "hypertrophy", "conditioning", "flexibility", "general"] as const;

function createEmptySession(orderIndex: number): ExerciseSession {
  return {
    id: generateId(),
    name: `Session ${orderIndex + 1}`,
    day_number: orderIndex + 1,
    notes: "",
    items: [],
  };
}

function createEmptyItem(exercise: Exercise, orderIndex: number): ExerciseSessionItem {
  return {
    id: generateId(),
    session_id: "",
    exercise_id: exercise.id,
    exercise,
    order_index: orderIndex,
    sets: 3,
    reps: "10",
    rest_seconds: 60,
    tempo: "",
    notes: "",
  };
}

export default function ExerciseTemplateBuilder({
  existingTemplate,
  onSave,
  onCancel,
}: ExerciseTemplateBuilderProps) {
  const [name, setName] = useState(existingTemplate?.name || "");
  const [description, setDescription] = useState(existingTemplate?.description || "");
  const [category, setCategory] = useState<string>(existingTemplate?.category || "general");
  const [durationWeeks, setDurationWeeks] = useState<string>(
    existingTemplate?.duration_weeks ? String(existingTemplate.duration_weeks) : ""
  );
  const [sessions, setSessions] = useState<ExerciseSession[]>(
    existingTemplate?.sessions.length ? existingTemplate.sessions : [createEmptySession(0)]
  );
  const [exercisePickerSessionId, setExercisePickerSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = !!existingTemplate;

  function updateSession(sessionId: string, updates: Partial<ExerciseSession>) {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updates } : s)));
  }

  function addSession() {
    setSessions((prev) => [...prev, createEmptySession(prev.length)]);
  }

  function removeSession(sessionId: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  function reorderSessions(reordered: ExerciseSession[]) {
    setSessions(reordered.map((s, i) => ({ ...s, day_number: i + 1 })));
  }

  function addExerciseToSession(sessionId: string, exercise: Exercise) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const newItem = createEmptyItem(exercise, s.items.length);
        return { ...s, items: [...s.items, { ...newItem, session_id: sessionId }] };
      })
    );
  }

  function updateItem(sessionId: string, itemId: string, updates: Partial<ExerciseSessionItem>) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return { ...s, items: s.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)) };
      })
    );
  }

  function removeItem(sessionId: string, itemId: string) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return { ...s, items: s.items.filter((item) => item.id !== itemId) };
      })
    );
  }

  function reorderItems(sessionId: string, reordered: ExerciseSessionItem[]) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return { ...s, items: reordered.map((item, i) => ({ ...item, order_index: i })) };
      })
    );
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const template: ExerciseTemplate = {
        id: existingTemplate?.id || generateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        duration_weeks: durationWeeks ? parseInt(durationWeeks, 10) : undefined,
        is_active: true,
        sessions,
        created_at: existingTemplate?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onSave(template);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Slide-over panel */}
      <div className="relative ml-auto w-full max-w-3xl bg-bg-primary border-l border-[rgba(0,0,0,0.08)] overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-[rgba(0,0,0,0.06)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            {isEditing ? "Edit Template" : "Create Exercise Template"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary border border-[rgba(0,0,0,0.08)] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-xs font-semibold bg-accent-bright text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Template meta */}
          <div className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Template Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 8-Week Strength Foundation"
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief overview of this template..."
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="w-36">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Duration (weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Sessions ({sessions.length})
              </label>
            </div>

            <DndSortableList
              items={sessions}
              onReorder={reorderSessions}
              renderItem={(session, index, dragHandleProps) => (
                <SessionCard
                  session={session}
                  index={index}
                  dragHandleProps={dragHandleProps}
                  onUpdate={(updates) => updateSession(session.id, updates)}
                  onRemove={() => removeSession(session.id)}
                  onAddExercise={() => setExercisePickerSessionId(session.id)}
                  onUpdateItem={(itemId, updates) => updateItem(session.id, itemId, updates)}
                  onRemoveItem={(itemId) => removeItem(session.id, itemId)}
                  onReorderItems={(reordered) => reorderItems(session.id, reordered)}
                  canRemove={sessions.length > 1}
                />
              )}
            />
          </div>

          {/* Add Session */}
          <button
            type="button"
            onClick={addSession}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[rgba(0,0,0,0.08)] hover:border-accent/30 rounded-2xl text-sm text-text-muted hover:text-accent-bright transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Session
          </button>
        </div>
      </div>

      {/* Exercise Picker */}
      {exercisePickerSessionId && (
        <ExercisePicker
          onPick={(exercise) => addExerciseToSession(exercisePickerSessionId, exercise)}
          onClose={() => setExercisePickerSessionId(null)}
        />
      )}
    </div>
  );
}

interface SessionCardProps {
  session: ExerciseSession;
  index: number;
  dragHandleProps: Record<string, unknown>;
  onUpdate: (updates: Partial<ExerciseSession>) => void;
  onRemove: () => void;
  onAddExercise: () => void;
  onUpdateItem: (itemId: string, updates: Partial<ExerciseSessionItem>) => void;
  onRemoveItem: (itemId: string) => void;
  onReorderItems: (reordered: ExerciseSessionItem[]) => void;
  canRemove: boolean;
}

function SessionCard({
  session,
  index,
  dragHandleProps,
  onUpdate,
  onRemove,
  onAddExercise,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  canRemove,
}: SessionCardProps) {
  return (
    <div className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
      {/* Session header */}
      <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.04)] flex items-center gap-3">
        <DragHandle {...dragHandleProps} />
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-bright flex-shrink-0">
          {index + 1}
        </div>
        <input
          type="text"
          value={session.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
          placeholder="Session name..."
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[10px] text-text-muted">Day</label>
          <input
            type="number"
            min="1"
            max="7"
            value={session.day_number}
            onChange={(e) => onUpdate({ day_number: parseInt(e.target.value, 10) || 1 })}
            className="w-12 bg-bg-primary border border-[rgba(0,0,0,0.06)] rounded-lg px-2 py-1 text-xs text-text-primary text-center focus:outline-none focus:border-accent/30 transition-colors"
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-text-muted hover:text-red-400 transition-colors p-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Session notes */}
        <div>
          <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Session Notes</label>
          <textarea
            value={session.notes || ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={2}
            placeholder="Warm-up instructions, focus areas, etc."
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.04)] rounded-lg px-3 py-2 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
        </div>

        {/* Exercise list */}
        {session.items.length > 0 && (
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Exercises</label>
            {/* Column headers */}
            <div className="grid gap-1 mb-1 px-9" style={{ gridTemplateColumns: "1fr 52px 64px 72px 80px 80px 28px" }}>
              {["Exercise", "Sets", "Reps", "Rest (s)", "Tempo", "Notes", ""].map((h) => (
                <div key={h} className="text-[9px] font-semibold text-text-muted uppercase tracking-wider truncate">{h}</div>
              ))}
            </div>
            <DndSortableList
              items={session.items}
              onReorder={onReorderItems}
              renderItem={(item, _idx, dragHandleProps) => (
                <ExerciseItemRow
                  item={item}
                  dragHandleProps={dragHandleProps}
                  onUpdate={(updates) => onUpdateItem(item.id, updates)}
                  onRemove={() => onRemoveItem(item.id)}
                />
              )}
            />
          </div>
        )}

        {/* Add exercise */}
        <button
          type="button"
          onClick={onAddExercise}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exercise
        </button>
      </div>
    </div>
  );
}

interface ExerciseItemRowProps {
  item: ExerciseSessionItem;
  dragHandleProps: Record<string, unknown>;
  onUpdate: (updates: Partial<ExerciseSessionItem>) => void;
  onRemove: () => void;
}

function ExerciseItemRow({ item, dragHandleProps, onUpdate, onRemove }: ExerciseItemRowProps) {
  const inputClass =
    "w-full bg-bg-primary border border-[rgba(0,0,0,0.06)] rounded-lg px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors text-center";

  return (
    <div className="flex items-center gap-1 group py-0.5">
      <DragHandle {...dragHandleProps} />
      {/* Exercise name */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary truncate px-2 py-1.5 bg-bg-primary border border-[rgba(0,0,0,0.06)] rounded-lg">
          {item.exercise?.name || "Unknown exercise"}
        </div>
      </div>
      {/* Sets */}
      <div className="w-[52px]">
        <input
          type="number"
          min="1"
          max="20"
          value={item.sets}
          onChange={(e) => onUpdate({ sets: parseInt(e.target.value, 10) || 1 })}
          className={inputClass}
        />
      </div>
      {/* Reps */}
      <div className="w-16">
        <input
          type="text"
          value={item.reps}
          onChange={(e) => onUpdate({ reps: e.target.value })}
          placeholder="10"
          className={inputClass}
        />
      </div>
      {/* Rest */}
      <div className="w-[72px]">
        <input
          type="number"
          min="0"
          step="5"
          value={item.rest_seconds ?? ""}
          onChange={(e) => onUpdate({ rest_seconds: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          placeholder="60"
          className={inputClass}
        />
      </div>
      {/* Tempo */}
      <div className="w-20">
        <input
          type="text"
          value={item.tempo || ""}
          onChange={(e) => onUpdate({ tempo: e.target.value })}
          placeholder="3-1-1-0"
          className={inputClass}
        />
      </div>
      {/* Notes */}
      <div className="w-20">
        <input
          type="text"
          value={item.notes || ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Notes"
          className={inputClass}
        />
      </div>
      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-1 cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
