"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Exercise } from "@/lib/types";

const MUSCLE_GROUPS = [
  { value: "", label: "All Muscle Groups" },
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "legs", label: "Legs" },
  { value: "arms", label: "Arms" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "full_body", label: "Full Body" },
];

const EQUIPMENT_OPTIONS = [
  { value: "", label: "All Equipment" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "cable", label: "Cable" },
  { value: "machine", label: "Machine" },
  { value: "resistance_band", label: "Resistance Band" },
  { value: "cardio_machine", label: "Cardio Machine" },
  { value: "other", label: "Other" },
];

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  legs: "Legs",
  arms: "Arms",
  core: "Core",
  cardio: "Cardio",
  full_body: "Full Body",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: "Bodyweight",
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  kettlebell: "Kettlebell",
  cable: "Cable",
  machine: "Machine",
  resistance_band: "Resistance Band",
  cardio_machine: "Cardio Machine",
  other: "Other",
};

interface EditingExercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  description: string;
  video_url: string;
}

const emptyForm = (): EditingExercise => ({
  id: "",
  name: "",
  muscle_group: "chest",
  equipment: "bodyweight",
  description: "",
  video_url: "",
});

export default function ExerciseLibraryPage() {
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EditingExercise>(emptyForm());

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditingExercise>(emptyForm());

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (muscleFilter) params.set("muscle_group", muscleFilter);
      if (equipmentFilter) params.set("equipment", equipmentFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/exercises?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExercises(data.exercises || []);
      } else {
        toast("Failed to load exercises", "error");
      }
    } catch {
      toast("Failed to load exercises", "error");
    } finally {
      setLoading(false);
    }
  }, [muscleFilter, equipmentFilter, search, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExercises();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchExercises, search]);

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.muscle_group) {
      toast("Name and muscle group are required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          muscle_group: addForm.muscle_group,
          equipment: addForm.equipment,
          description: addForm.description.trim() || null,
          video_url: addForm.video_url.trim() || null,
        }),
      });
      if (res.ok) {
        toast("Exercise added");
        setAddForm(emptyForm());
        setShowAdd(false);
        fetchExercises();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to add exercise", "error");
      }
    } catch {
      toast("Failed to add exercise", "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(ex: Exercise) {
    setEditingId(ex.id);
    setEditForm({
      id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      equipment: ex.equipment,
      description: ex.description || "",
      video_url: ex.video_url || "",
    });
  }

  async function handleSaveEdit() {
    if (!editForm.name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exercises", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name.trim(),
          muscle_group: editForm.muscle_group,
          equipment: editForm.equipment,
          description: editForm.description.trim() || null,
          video_url: editForm.video_url.trim() || null,
        }),
      });
      if (res.ok) {
        toast("Exercise updated");
        setEditingId(null);
        fetchExercises();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update exercise", "error");
      }
    } catch {
      toast("Failed to update exercise", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exercises", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast("Exercise removed");
        setDeletingId(null);
        fetchExercises();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to remove exercise", "error");
      }
    } catch {
      toast("Failed to remove exercise", "error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40";

  const selectClass =
    "bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/40 cursor-pointer";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Exercise Library</h1>
          <p className="text-text-secondary mt-1">
            {loading ? "Loading..." : `${exercises.length} exercise${exercises.length !== 1 ? "s" : ""}${muscleFilter || equipmentFilter || search ? " (filtered)" : ""}`}
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Exercise
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-4">New Exercise</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Barbell Back Squat"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Muscle Group <span className="text-red-400">*</span></label>
              <select
                value={addForm.muscle_group}
                onChange={(e) => setAddForm((f) => ({ ...f, muscle_group: e.target.value }))}
                className={`${selectClass} w-full`}
              >
                {MUSCLE_GROUPS.slice(1).map((mg) => (
                  <option key={mg.value} value={mg.value}>{mg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Equipment</label>
              <select
                value={addForm.equipment}
                onChange={(e) => setAddForm((f) => ({ ...f, equipment: e.target.value }))}
                className={`${selectClass} w-full`}
              >
                {EQUIPMENT_OPTIONS.slice(1).map((eq) => (
                  <option key={eq.value} value={eq.value}>{eq.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Video URL</label>
              <input
                type="url"
                value={addForm.video_url}
                onChange={(e) => setAddForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtube.com/..."
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Brief description, cues, or notes"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-5 py-2 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer"
            >
              {saving ? "Saving..." : "Add Exercise"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddForm(emptyForm()); }}
              className="px-5 py-2 text-text-muted text-sm hover:text-text-secondary cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises..."
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl pl-9 pr-3 py-2 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <select
            value={muscleFilter}
            onChange={(e) => setMuscleFilter(e.target.value)}
            className={selectClass}
          >
            {MUSCLE_GROUPS.map((mg) => (
              <option key={mg.value} value={mg.value}>{mg.label}</option>
            ))}
          </select>
          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className={selectClass}
          >
            {EQUIPMENT_OPTIONS.map((eq) => (
              <option key={eq.value} value={eq.value}>{eq.label}</option>
            ))}
          </select>
          {(muscleFilter || equipmentFilter || search) && (
            <button
              onClick={() => { setMuscleFilter(""); setEquipmentFilter(""); setSearch(""); }}
              className="px-3 py-2 text-text-muted text-sm hover:text-text-secondary border border-[rgba(0,0,0,0.08)] rounded-xl cursor-pointer transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-lg h-5 flex-1" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-lg h-5 w-24" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-lg h-5 w-24" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-lg h-5 w-32" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-lg h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : exercises.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
            <p className="text-text-muted text-sm">No exercises found</p>
            {(muscleFilter || equipmentFilter || search) && (
              <p className="text-text-muted text-xs mt-1">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Muscle Group</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Equipment</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Description</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {exercises.map((ex) => (
                <tr
                  key={ex.id}
                  className={`group transition-colors ${editingId === ex.id ? "bg-accent/[0.03]" : "hover:bg-[rgba(0,0,0,0.015)]"}`}
                >
                  {editingId === ex.id ? (
                    /* Inline edit row */
                    <>
                      <td className="px-5 py-3" colSpan={4}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className={inputClass}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Muscle Group</label>
                            <select
                              value={editForm.muscle_group}
                              onChange={(e) => setEditForm((f) => ({ ...f, muscle_group: e.target.value }))}
                              className={`${selectClass} w-full`}
                            >
                              {MUSCLE_GROUPS.slice(1).map((mg) => (
                                <option key={mg.value} value={mg.value}>{mg.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Equipment</label>
                            <select
                              value={editForm.equipment}
                              onChange={(e) => setEditForm((f) => ({ ...f, equipment: e.target.value }))}
                              className={`${selectClass} w-full`}
                            >
                              {EQUIPMENT_OPTIONS.slice(1).map((eq) => (
                                <option key={eq.value} value={eq.value}>{eq.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Video URL</label>
                            <input
                              type="url"
                              value={editForm.video_url}
                              onChange={(e) => setEditForm((f) => ({ ...f, video_url: e.target.value }))}
                              placeholder="https://..."
                              className={inputClass}
                            />
                          </div>
                          <div className="md:col-span-2 lg:col-span-4">
                            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">Description</label>
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Optional description or cues"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                        <div className="flex items-start justify-end gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="px-3.5 py-1.5 gradient-accent text-white rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3.5 py-1.5 text-text-muted text-xs hover:text-text-secondary cursor-pointer border border-[rgba(0,0,0,0.08)] rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    /* Read-only row */
                    <>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">{ex.name}</span>
                          {ex.video_url && (
                            <a
                              href={ex.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-muted hover:text-accent-bright transition-colors"
                              title="View video"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent-bright">
                          {MUSCLE_GROUP_LABELS[ex.muscle_group] || ex.muscle_group}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-text-secondary">
                          {EQUIPMENT_LABELS[ex.equipment] || ex.equipment}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-text-muted line-clamp-1 max-w-xs">
                          {ex.description || <span className="text-text-muted/50 italic">No description</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(ex)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[rgba(0,0,0,0.05)] transition-all cursor-pointer"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deletingId === ex.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(ex.id)}
                                disabled={saving}
                                className="px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-2.5 py-1 text-[11px] text-text-muted hover:text-text-secondary cursor-pointer"
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeletingId(ex.id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
