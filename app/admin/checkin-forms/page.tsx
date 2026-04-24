"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CheckinFormConfig, CheckinFormTemplate, FormQuestion, ProgressMetric } from "@/lib/types";
import {
  DEFAULT_CHECKIN_QUESTIONS,
  DEFAULT_PROGRESS_METRICS,
  buildFallbackCheckinConfig,
  getTemplateLabel,
  normalizeCheckinConfig,
} from "@/lib/checkin-form";

const NEW_TEMPLATE_ID = "__new__";

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full transition-colors ${enabled ? "bg-[#E040D0]" : "bg-[rgba(0,0,0,0.1)]"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function SectionHeader({
  title,
  description,
  open,
  onToggle,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between text-left cursor-pointer"
    >
      <div>
        <div className="text-base font-heading font-bold text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-muted">{description}</div>
      </div>
      <svg
        className={`h-5 w-5 flex-shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function buildSnapshot({
  templateName,
  templateDescription,
  title,
  questions,
  progressMetrics,
  makeDefault,
}: {
  templateName: string;
  templateDescription: string;
  title: string;
  questions: FormQuestion[];
  progressMetrics: ProgressMetric[];
  makeDefault: boolean;
}) {
  return JSON.stringify({
    templateName,
    templateDescription,
    title,
    questions,
    progress_tracking: progressMetrics,
    makeDefault,
  });
}

export default function CheckinFormsPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl"><div className="h-8 w-48 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" /></div>}>
      <CheckinFormsInner />
    </Suspense>
  );
}

function CheckinFormsInner() {
  const [templates, setTemplates] = useState<CheckinFormTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(NEW_TEMPLATE_ID);
  const [templateName, setTemplateName] = useState("New Check-in Form");
  const [templateDescription, setTemplateDescription] = useState("");
  const [title, setTitle] = useState("Weekly Check-in");
  const [questions, setQuestions] = useState<FormQuestion[]>(normalizeCheckinConfig(buildFallbackCheckinConfig()).questions);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetric[]>(normalizeCheckinConfig(buildFallbackCheckinConfig()).progress_tracking || []);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const clientOverrideId = searchParams.get("forClient");
  const clientOverrideName = searchParams.get("clientName");
  const baseTemplateId = searchParams.get("base");

  function loadTemplateIntoEditor(template: CheckinFormTemplate) {
    const config = normalizeCheckinConfig(template.config);
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setTitle(config.title || "Weekly Check-in");
    setQuestions(config.questions);
    setProgressMetrics(config.progress_tracking || []);
    setMakeDefault(template.is_default);
    setQuestionsOpen(true);
    setProgressOpen(true);
    setInitialSnapshot(buildSnapshot({
      templateName: template.name,
      templateDescription: template.description || "",
      title: config.title || "Weekly Check-in",
      questions: config.questions,
      progressMetrics: config.progress_tracking || [],
      makeDefault: template.is_default,
    }));
  }

  function resetEditorToDefaults(message?: string) {
    const config = normalizeCheckinConfig(buildFallbackCheckinConfig());
    setSelectedTemplateId(NEW_TEMPLATE_ID);
    setTemplateName("New Check-in Form");
    setTemplateDescription("");
    setTitle(config.title || "Weekly Check-in");
    setQuestions(config.questions);
    setProgressMetrics(config.progress_tracking || []);
    setMakeDefault(false);
    setQuestionsOpen(true);
    setProgressOpen(true);
    setInitialSnapshot(buildSnapshot({
      templateName: "New Check-in Form",
      templateDescription: "",
      title: config.title || "Weekly Check-in",
      questions: config.questions,
      progressMetrics: config.progress_tracking || [],
      makeDefault: false,
    }));
    if (message) setSaveMessage(message);
  }

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/admin/checkin-templates");
        if (!res.ok) throw new Error("Failed to load templates");

        const data = await res.json();
        const loadedTemplates: CheckinFormTemplate[] = data.templates || [];
        setTemplates(loadedTemplates);

        // Per-client override flow: if ?base=X is supplied, load that template,
        // pre-title it "{ClientName} — Weekly Check-in", and let the coach branch it.
        const baseTemplate = baseTemplateId
          ? loadedTemplates.find((template) => template.id === baseTemplateId)
          : null;

        if (baseTemplate && clientOverrideId && clientOverrideName) {
          const config = normalizeCheckinConfig(baseTemplate.config);
          setSelectedTemplateId(NEW_TEMPLATE_ID);
          setTemplateName(`${clientOverrideName} — Weekly Check-in`);
          setTemplateDescription(`Client-specific form based on "${baseTemplate.name}".`);
          setTitle(config.title || "Weekly Check-in");
          setQuestions(config.questions);
          setProgressMetrics(config.progress_tracking || []);
          setMakeDefault(false);
          setInitialSnapshot(""); // anything is "unsaved changes" from this fresh draft
          setLoading(false);
          setSaveMessage(`Creating a custom form for ${clientOverrideName} — saving as new will assign it automatically.`);
          return;
        }

        const preferredTemplate =
          loadedTemplates.find((template) => template.is_default) ||
          loadedTemplates[0];

        if (preferredTemplate) {
          loadTemplateIntoEditor(preferredTemplate);
        } else {
          resetEditorToDefaults();
        }
      } catch {
        resetEditorToDefaults("Couldn't load saved templates, so a fresh draft is ready.");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleQuestion(idx: number) {
    setQuestions((prev) => prev.map((question, i) => i === idx ? { ...question, enabled: !question.enabled } : question));
  }

  function updateQuestionLabel(idx: number, label: string) {
    setQuestions((prev) => prev.map((question, i) => i === idx ? { ...question, label } : question));
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustomQuestion() {
    setQuestions((prev) => [
      ...prev,
      { id: generateId(), label: "", placeholder: "", type: "textarea", enabled: true },
    ]);
  }

  function toggleMetric(idx: number) {
    setProgressMetrics((prev) => prev.map((metric, i) => i === idx ? { ...metric, enabled: !metric.enabled } : metric));
  }

  function updateMetricLabel(idx: number, label: string) {
    setProgressMetrics((prev) => prev.map((metric, i) => i === idx ? { ...metric, label } : metric));
  }

  function removeMetric(idx: number) {
    setProgressMetrics((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustomMetric() {
    setProgressMetrics((prev) => [
      ...prev,
      { id: generateId(), label: "", type: "number", enabled: true },
    ]);
  }

  function resetToDefaults() {
    const config = normalizeCheckinConfig(buildFallbackCheckinConfig());
    setTitle(config.title || "Weekly Check-in");
    setQuestions(config.questions);
    setProgressMetrics(config.progress_tracking || []);
    setQuestionsOpen(true);
    setProgressOpen(true);
    setSaveMessage("Reset to defaults locally - save when ready.");
  }

  const currentSnapshot = useMemo(() => buildSnapshot({
    templateName,
    templateDescription,
    title,
    questions,
    progressMetrics,
    makeDefault,
  }), [templateName, templateDescription, title, questions, progressMetrics, makeDefault]);

  const isNewDraft = selectedTemplateId === NEW_TEMPLATE_ID;
  const activeTemplate = isNewDraft ? null : templates.find((template) => template.id === selectedTemplateId) || null;
  const hasUnsavedChanges = initialSnapshot !== "" && currentSnapshot !== initialSnapshot;
  const assignedCount = activeTemplate?.assigned_client_count || 0;
  const enabledQuestionCount = questions.filter((question) => question.enabled !== false).length;
  const enabledMetricCount = progressMetrics.filter((metric) => metric.enabled).length;
  const customQuestionCount = questions.filter((question) => !DEFAULT_CHECKIN_QUESTIONS.find((defaultQuestion) => defaultQuestion.id === question.id)).length;
  const customMetricCount = progressMetrics.filter((metric) => !DEFAULT_PROGRESS_METRICS.find((defaultMetric) => defaultMetric.id === metric.id)).length;

  const config: CheckinFormConfig = {
    title,
    checkin_day: "monday",
    mood_enabled: true,
    mood_options: [
      { value: "great", label: "Great", color: "emerald" },
      { value: "good", label: "Good", color: "blue" },
      { value: "okay", label: "Okay", color: "amber" },
      { value: "struggling", label: "Struggling", color: "red" },
    ],
    questions,
    progress_tracking: progressMetrics,
  };

  async function handleSaveChanges() {
    if (isNewDraft) return;
    setSaving(true);
    setSaveMessage("");

    try {
      const res = await fetch("/api/admin/checkin-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTemplateId,
          name: templateName,
          description: templateDescription,
          config,
          is_default: makeDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save changes");
      }

      const data = await res.json();
      const savedTemplate: CheckinFormTemplate = data.template;
      const nextTemplates = templates.map((template) => (
        template.id === savedTemplate.id
          ? savedTemplate
          : { ...template, is_default: makeDefault ? false : template.is_default }
      ));
      setTemplates(nextTemplates);
      loadTemplateIntoEditor(savedTemplate);
      setSaveMessage("Changes saved.");
      setTimeout(() => setSaveMessage(""), 2500);
    } catch (error) {
      setSaveMessage(`Error: ${error instanceof Error ? error.message : "Failed to save changes"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    if (isNewDraft) return;
    setDeleting(true);
    setSaveMessage("");
    try {
      const res = await fetch("/api/admin/checkin-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplateId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete template");
      }
      const remaining = templates.filter((template) => template.id !== selectedTemplateId);
      setTemplates(remaining);
      const next = remaining.find((template) => template.is_default) || remaining[0];
      if (next) {
        loadTemplateIntoEditor(next);
      } else {
        resetEditorToDefaults();
      }
      setSaveMessage("Template deleted.");
      setConfirmDelete(false);
      setTimeout(() => setSaveMessage(""), 2500);
    } catch (error) {
      setSaveMessage(`Error: ${error instanceof Error ? error.message : "Failed to delete template"}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveAsNew() {
    setSaving(true);
    setSaveMessage("");
    const shouldMakeDefault = clientOverrideId ? false : makeDefault;

    try {
      const res = await fetch("/api/admin/checkin-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          config,
          is_default: shouldMakeDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create template");
      }

      const data = await res.json();
      const savedTemplate: CheckinFormTemplate = data.template;
      const nextTemplates = [
        ...templates.map((template) => ({ ...template, is_default: shouldMakeDefault ? false : template.is_default })),
        savedTemplate,
      ].sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
      setTemplates(nextTemplates);
      loadTemplateIntoEditor(savedTemplate);

      // Per-client override flow: auto-assign the new template to the client and bounce back.
      if (clientOverrideId) {
        try {
          const assignRes = await fetch(`/api/admin/clients/${clientOverrideId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkin_form_id: savedTemplate.id }),
          });
          if (assignRes.ok) {
            setSaveMessage(`Custom form saved and assigned to ${clientOverrideName || "client"}. Taking you back...`);
            setTimeout(() => {
              router.push(`/admin/clients/${clientOverrideId}`);
            }, 1200);
            return;
          }
          throw new Error("auto-assign failed");
        } catch {
          const rollbackRes = await fetch("/api/admin/checkin-templates", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: savedTemplate.id }),
          }).catch(() => null);
          if (!rollbackRes?.ok) {
            throw new Error("Couldn't auto-assign the new form, and the rollback also failed. Please delete the orphaned draft manually before trying again.");
          }
          throw new Error("Couldn't auto-assign the new form to the client, so the draft was rolled back. Please try again.");
        }
      } else {
        setSaveMessage(isNewDraft ? "New form created." : "New form created from this version.");
      }
      setTimeout(() => setSaveMessage(""), 4000);
    } catch (error) {
      setSaveMessage(`Error: ${error instanceof Error ? error.message : "Failed to create template"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="mb-8">
          <div className="mb-2 h-8 w-48 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.06)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Check-in Forms</h1>
        <p className="mt-1 text-text-secondary">Create multiple weekly check-in templates, then assign the right one to each client.</p>
      </div>

      {clientOverrideId && clientOverrideName && (
        <div className="mb-4 rounded-2xl border border-[#E040D0]/25 bg-[#E040D0]/8 px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E040D0]">
            Per-client override
          </div>
          <div className="mt-1 text-sm font-semibold text-text-primary">
            Creating a custom form for {clientOverrideName}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Edit the questions or metrics you want changed, then click <strong>Save as new</strong> — the new form will be assigned to {clientOverrideName} automatically and the master template stays untouched.
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">Current Template</label>
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const nextId = event.target.value;
                setConfirmDelete(false);
                if (nextId === NEW_TEMPLATE_ID) {
                  resetEditorToDefaults();
                  return;
                }
                const nextTemplate = templates.find((template) => template.id === nextId);
                if (nextTemplate) {
                  loadTemplateIntoEditor(nextTemplate);
                }
              }}
              className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-[#E040D0]/40 transition-colors"
            >
              <option value={NEW_TEMPLATE_ID}>New form draft</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {getTemplateLabel(template)}{typeof template.assigned_client_count === "number" && template.assigned_client_count > 0 ? ` — ${template.assigned_client_count} client${template.assigned_client_count === 1 ? "" : "s"}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-text-muted">
              {isNewDraft ? "You're creating a new template draft." : "Editing a saved template. Save changes to update it, or save as new to branch it."}
            </p>
            {!isNewDraft && activeTemplate && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`rounded-full border px-2.5 py-1 uppercase tracking-[0.14em] ${activeTemplate.is_default ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-muted"}`}>
                  {activeTemplate.is_default ? "Default form" : "Not default"}
                </span>
                <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-bg-primary px-2.5 py-1 uppercase tracking-[0.14em] text-text-muted">
                  {(activeTemplate.assigned_client_count || 0) === 0 ? "No clients assigned" : `${activeTemplate.assigned_client_count} client${activeTemplate.assigned_client_count === 1 ? "" : "s"} assigned`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => resetEditorToDefaults("Started a fresh draft.")}
              className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-[#E040D0]/30 lg:w-auto"
            >
              Start New Form
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Enabled Questions</div>
          <div className="mt-2 text-2xl font-heading font-bold text-text-primary">{enabledQuestionCount}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Enabled Metrics</div>
          <div className="mt-2 text-2xl font-heading font-bold text-text-primary">{enabledMetricCount}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Custom Questions</div>
          <div className="mt-2 text-2xl font-heading font-bold text-text-primary">{customQuestionCount}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Custom Metrics</div>
          <div className="mt-2 text-2xl font-heading font-bold text-text-primary">{customMetricCount}</div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
          <label className="mb-2 block text-sm font-medium text-text-primary">Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Weekly Check-in for Fat Loss"
            className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
          />
          <p className="mt-2 text-xs text-text-muted">This is the admin label Gordy will pick from when assigning a client.</p>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
          <label className="mb-2 block text-sm font-medium text-text-primary">Template Description</label>
          <input
            type="text"
            value={templateDescription}
            onChange={(event) => setTemplateDescription(event.target.value)}
            placeholder="Best for coached clients focused on physique and habit adherence"
            className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
          />
          <label className="mt-4 flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={clientOverrideId ? false : makeDefault}
              onChange={(event) => setMakeDefault(event.target.checked)}
              disabled={!!clientOverrideId}
              className="h-4 w-4 rounded border-[rgba(0,0,0,0.2)] text-[#E040D0] focus:ring-[#E040D0]/40"
            />
            {clientOverrideId ? "Per-client overrides can't become Gordy&apos;s default form" : "Set this as Gordy&apos;s default check-in form"}
          </label>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
        <label className="mb-2 block text-sm font-medium text-text-primary">Client-Facing Form Title</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Weekly Check-in"
          className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
        />
      </div>

      <div className="mb-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
        <SectionHeader
          title="Check-in Questions"
          description="Questions clients answer during their weekly check-in"
          open={questionsOpen}
          onToggle={() => setQuestionsOpen((open) => !open)}
        />

        {questionsOpen && (
          <div className="mt-4 space-y-2">
            {questions.map((question, idx) => (
              <div
                key={question.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  question.enabled
                    ? "border-[rgba(0,0,0,0.06)] bg-bg-primary"
                    : "border-[rgba(0,0,0,0.04)] bg-[rgba(0,0,0,0.01)] opacity-60"
                }`}
              >
                <Toggle enabled={!!question.enabled} onToggle={() => toggleQuestion(idx)} />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={question.label}
                    onChange={(event) => updateQuestionLabel(idx, event.target.value)}
                    placeholder="Question label"
                    className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <div className="mt-0.5 text-[10px] text-text-muted">
                    {question.type === "select" ? question.options?.join(" / ") : question.type === "file" ? "Photo upload" : "Free text"}
                  </div>
                </div>
                {!DEFAULT_CHECKIN_QUESTIONS.find((defaultQuestion) => defaultQuestion.id === question.id) && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="cursor-pointer p-1 text-text-muted transition-colors hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addCustomQuestion}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(0,0,0,0.08)] py-2.5 text-xs text-text-muted transition-colors hover:border-[#E040D0]/30 hover:text-[#E040D0]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom question
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
        <SectionHeader
          title="Progress Tracking"
          description="Numeric metrics tracked over time and shown as trends"
          open={progressOpen}
          onToggle={() => setProgressOpen((open) => !open)}
        />

        {progressOpen && (
          <div className="mt-4 space-y-2">
            {progressMetrics.map((metric, idx) => (
              <div
                key={metric.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  metric.enabled
                    ? "border-[rgba(0,0,0,0.06)] bg-bg-primary"
                    : "border-[rgba(0,0,0,0.04)] bg-[rgba(0,0,0,0.01)] opacity-60"
                }`}
              >
                <Toggle enabled={metric.enabled} onToggle={() => toggleMetric(idx)} />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={metric.label}
                    onChange={(event) => updateMetricLabel(idx, event.target.value)}
                    placeholder="Metric label"
                    className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <div className="mt-0.5 text-[10px] text-text-muted">
                    {metric.type === "scale" ? `Scale ${metric.min ?? 1}-${metric.max ?? 10}` : metric.type === "select" ? `Select: ${metric.options?.join(" / ") ?? ""}` : `Number${metric.unit ? ` (${metric.unit})` : ""}`}
                  </div>
                </div>
                {!DEFAULT_PROGRESS_METRICS.find((defaultMetric) => defaultMetric.id === metric.id) && (
                  <button
                    type="button"
                    onClick={() => removeMetric(idx)}
                    className="cursor-pointer p-1 text-text-muted transition-colors hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addCustomMetric}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(0,0,0,0.08)] py-2.5 text-xs text-text-muted transition-colors hover:border-[#E040D0]/30 hover:text-[#E040D0]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom metric
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {saveMessage ? (
            <span className={saveMessage.startsWith("Error") ? "text-red-400" : "text-emerald-400"}>{saveMessage}</span>
          ) : hasUnsavedChanges ? (
            <span className="text-amber-500">Unsaved changes — remember to save or save as new</span>
          ) : (
            <span className="text-text-muted">{isNewDraft ? "Draft ready to save" : "All changes saved"}</span>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={resetToDefaults}
            className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-card px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-[#E040D0]/30"
          >
            Reset to Defaults
          </button>
          {!isNewDraft && (
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving || deleting}
              className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-[#E040D0]/30 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveAsNew}
            disabled={saving || deleting}
            className="gradient-accent rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save As New Form"}
          </button>
        </div>
      </div>

      {!isNewDraft && activeTemplate && !activeTemplate.is_default && (
        <div className="mt-6 rounded-2xl border border-red-500/15 bg-red-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-text-primary">Delete this template</div>
              <div className="mt-1 text-xs text-text-muted">
                {assignedCount > 0
                  ? `${assignedCount} client${assignedCount === 1 ? "" : "s"} still assigned — reassign them before deleting.`
                  : "Permanent — existing check-ins stay but their template link is cleared."}
              </div>
            </div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting || assignedCount > 0}
                className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete Template
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-2 text-xs font-semibold text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  disabled={deleting}
                  className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
