"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Exercise } from "@/lib/types";

interface ExercisePickerProps {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

export default function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (muscleGroup) params.set("muscle_group", muscleGroup);
    if (equipment) params.set("equipment", equipment);

    fetch(`/api/admin/exercises?${params.toString()}`)
      .then((r) => r.ok ? r.json() : { exercises: [] })
      .then((d) => setExercises(d.exercises || []))
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [search, muscleGroup, equipment]);

  const muscleGroups = Array.from(new Set(exercises.map((e) => e.muscle_group).filter(Boolean))).sort();
  const equipmentOptions = Array.from(new Set(exercises.map((e) => e.equipment).filter(Boolean))).sort();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-heading font-bold text-text-primary">Add Exercise</h3>
            <p className="text-[10px] text-text-muted mt-0.5">Select an exercise from the library</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-[rgba(0,0,0,0.04)] space-y-2 flex-shrink-0">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => {
              setLoading(true);
              setSearch(e.target.value);
            }}
            placeholder="Search exercises..."
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
          <div className="flex gap-2">
            <select
              value={muscleGroup}
              onChange={(e) => {
                setLoading(true);
                setMuscleGroup(e.target.value);
              }}
              className="flex-1 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
            >
              <option value="">All muscle groups</option>
              {muscleGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              value={equipment}
              onChange={(e) => {
                setLoading(true);
                setEquipment(e.target.value);
              }}
              className="flex-1 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
            >
              <option value="">All equipment</option>
              {equipmentOptions.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="px-5 py-8 text-center">
              <div className="text-text-muted text-sm">Loading...</div>
            </div>
          ) : exercises.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-text-muted text-sm">No exercises found.</div>
              {(search || muscleGroup || equipment) && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setSearch("");
                    setMuscleGroup("");
                    setEquipment("");
                  }}
                  className="mt-2 text-xs text-accent-bright hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            exercises.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => { onPick(exercise); onClose(); }}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(0,0,0,0.03)] transition-colors text-left border-b border-[rgba(0,0,0,0.03)] last:border-0 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{exercise.name}</div>
                  {exercise.description && (
                    <div className="text-[10px] text-text-muted mt-0.5 truncate max-w-xs">{exercise.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {exercise.muscle_group && (
                    <span className="text-[10px] px-2 py-0.5 bg-accent/8 text-accent-bright rounded-md border border-accent/15 font-medium">
                      {exercise.muscle_group}
                    </span>
                  )}
                  {exercise.equipment && (
                    <span className="text-[10px] px-2 py-0.5 bg-[rgba(0,0,0,0.04)] text-text-muted rounded-md border border-[rgba(0,0,0,0.06)]">
                      {exercise.equipment}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(0,0,0,0.06)] flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-text-muted">
            {loading ? "Loading..." : `${exercises.length} exercise${exercises.length !== 1 ? "s" : ""}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-secondary border border-[rgba(0,0,0,0.08)] rounded-xl hover:bg-[rgba(0,0,0,0.03)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
