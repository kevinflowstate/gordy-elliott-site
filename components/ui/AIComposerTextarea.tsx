"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

export const SHIFT_AI_INPUT_CLASS = "shift-ai-input";

const BASE_CLASS =
  "w-full resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] px-4 py-3.5 pr-12 text-base focus:outline-none focus:border-[rgba(224,64,208,0.3)] transition-colors disabled:cursor-not-allowed";

type AIComposerTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const AIComposerTextarea = forwardRef<HTMLTextAreaElement, AIComposerTextareaProps>(
  ({ className = "", style, ...props }, ref) => (
    <textarea
      ref={ref}
      data-shift-ai-input="composer"
      data-lpignore="true"
      data-1p-ignore="true"
      data-form-type="other"
      autoComplete={props.autoComplete ?? "off"}
      autoCapitalize={props.autoCapitalize ?? "sentences"}
      autoCorrect={props.autoCorrect ?? "on"}
      spellCheck={props.spellCheck ?? true}
      enterKeyHint={props.enterKeyHint ?? "send"}
      inputMode={props.inputMode ?? "text"}
      className={`${SHIFT_AI_INPUT_CLASS} ${BASE_CLASS} ${className}`.trim()}
      style={{ minHeight: "48px", maxHeight: "120px", ...style }}
      {...props}
    />
  ),
);

AIComposerTextarea.displayName = "AIComposerTextarea";

export default AIComposerTextarea;
