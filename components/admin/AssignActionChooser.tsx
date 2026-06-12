"use client";

type AssignActionChooserProps = {
  title: string;
  description?: string;
  templateLabel?: string;
  scratchLabel?: string;
  onUseTemplate: () => void;
  onBuildFromScratch: () => void;
  onClose: () => void;
};

export default function AssignActionChooser({
  title,
  description,
  templateLabel = "Use a template",
  scratchLabel = "Build from scratch",
  onUseTemplate,
  onBuildFromScratch,
  onClose,
}: AssignActionChooserProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-card p-6 shadow-2xl mx-4">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-heading font-bold text-text-primary">{title}</h3>
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={onUseTemplate}
            className="w-full rounded-xl border border-[#E040D0]/25 bg-[#E040D0]/10 px-4 py-4 text-left transition-colors hover:bg-[#E040D0]/15"
          >
            <div className="text-sm font-semibold text-text-primary">{templateLabel}</div>
            <div className="mt-1 text-xs text-text-muted">Pick from saved templates and assign it now.</div>
          </button>
          <button
            type="button"
            onClick={onBuildFromScratch}
            className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-4 text-left transition-colors hover:border-[#E040D0]/30"
          >
            <div className="text-sm font-semibold text-text-primary">{scratchLabel}</div>
            <div className="mt-1 text-xs text-text-muted">Create a client-specific version without leaving this flow.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
