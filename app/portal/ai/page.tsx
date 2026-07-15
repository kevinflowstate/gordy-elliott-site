"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import AIComposerTextarea from "@/components/ui/AIComposerTextarea";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      return (
        <Link
          key={i}
          href={linkMatch[2]}
          className="text-accent-bright hover:underline font-medium"
        >
          {linkMatch[1]}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className="font-semibold text-text-primary">
          {line.slice(2, -2)}
        </p>
      );
    }
    const boldParts = line.split(/(\*\*.*?\*\*)/g);
    const rendered = boldParts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{renderMarkdown(part)}</span>;
    });
    if (line.trim() === "") return <br key={i} />;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li key={i} className="ml-4 list-disc text-text-secondary">
          {rendered.slice(0, 1)}
          {boldParts.length > 1 ? rendered.slice(1) : renderMarkdown(line.slice(2))}
        </li>
      );
    }
    return <p key={i}>{rendered}</p>;
  });
}

export default function ShiftAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState<string>("coached");
  const [composerFocused, setComposerFocused] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerBarRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const resetDocumentScroll = useCallback(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
  }, []);

  const pinLatestToComposer = useCallback(() => {
    const scroller = threadRef.current;
    const composer = composerBarRef.current;
    if (!scroller || !composer) return;

    scroller.scrollTop = scroller.scrollHeight;
    window.requestAnimationFrame(() => {
      const latest = scroller.querySelector(".shift-ai-message:last-of-type");
      if (!latest) return;
      const latestRect = latest.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      const visualBottom = window.visualViewport
        ? Math.min(window.visualViewport.height + window.visualViewport.offsetTop, window.innerHeight)
        : window.innerHeight;
      const targetBottom = Math.min(composerRect.top, visualBottom) - 8;
      if (latestRect.bottom > targetBottom) {
        scroller.scrollTop += latestRect.bottom - targetBottom;
      }
    });
  }, []);

  const keepComposerVisible = useCallback(() => {
    resetDocumentScroll();
    pinLatestToComposer();
    for (const delay of [16, 48, 120, 220]) {
      window.setTimeout(() => {
        resetDocumentScroll();
        pinLatestToComposer();
      }, delay);
    }
  }, [pinLatestToComposer, resetDocumentScroll]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    if (composerFocused) keepComposerVisible();
  }, [composerFocused, keepComposerVisible, messages, loading]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const composer = composerBarRef.current;
    if (!composer) return undefined;

    const measureComposer = () => {
      const rect = composer.getBoundingClientRect();
      root.style.setProperty("--shift-ai-composer-height", `${Math.ceil(rect.height || 72)}px`);
    };

    measureComposer();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureComposer) : null;
    observer?.observe(composer);
    window.addEventListener("resize", measureComposer, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureComposer);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let timers: number[] = [];

    const clearTimers = () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers = [];
    };

    const keyboardInset = () => {
      const viewport = window.visualViewport;
      if (!viewport || !composerFocused) return 0;
      return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    };

    const applyViewportVars = () => {
      const viewport = window.visualViewport;
      const inset = keyboardInset();
      root.style.setProperty("--shift-ai-keyboard-inset", `${inset}px`);
      root.style.setProperty("--shift-ai-visual-height", `${Math.round(viewport?.height || window.innerHeight)}px`);
      root.classList.toggle("shift-ai-keyboard-open", composerFocused && inset > 24);
      root.classList.toggle("shift-ai-composer-focused", composerFocused);
    };

    const settle = () => {
      applyViewportVars();
      if (!composerFocused) return;
      resetDocumentScroll();
      pinLatestToComposer();
    };

    const scheduleSettle = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(settle);
      clearTimers();
      if (composerFocused) {
        timers = [0, 24, 72, 150, 260].map((delay) => window.setTimeout(settle, delay));
      }
    };

    scheduleSettle();
    window.addEventListener("resize", scheduleSettle, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleSettle, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleSettle, { passive: true });
    document.addEventListener("selectionchange", scheduleSettle, { passive: true });

    return () => {
      clearTimers();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleSettle);
      window.visualViewport?.removeEventListener("resize", scheduleSettle);
      window.visualViewport?.removeEventListener("scroll", scheduleSettle);
      document.removeEventListener("selectionchange", scheduleSettle);
      root.classList.remove("shift-ai-keyboard-open");
      root.classList.remove("shift-ai-composer-focused");
      root.style.setProperty("--shift-ai-keyboard-inset", "0px");
      root.style.setProperty("--shift-ai-visual-height", `${window.innerHeight}px`);
    };
  }, [composerFocused, pinLatestToComposer, resetDocumentScroll]);

  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tier) setTier(d.tier); })
      .catch(() => {});
  }, []);

  const quickPrompts: Record<string, string[]> = {
    coached: [
      "What should I focus on this week?",
      "Swap a meal I'm struggling with",
      "What training do I have left today?",
      "Summarise my progress this month",
    ],
    premium: [
      "What's the one thing I should tighten this week?",
      "Swap a meal I'm struggling with",
      "What training do I have left today?",
      "Draft my priority message for Gordy",
    ],
    vip: [
      "What should Gordy see first about me this week?",
      "Swap a meal I'm struggling with",
      "What training do I have left today?",
      "Give me a 3-bullet summary of my last check-in",
    ],
    ai_only: [
      "What should I focus on this week?",
      "Help me plan today's session",
      "Swap a food I'm stuck on",
      "How have I been doing recently?",
    ],
  };
  const prompts = quickPrompts[tier] || quickPrompts.coached;

  async function handleSend(override?: string) {
    const trimmed = (override || input).trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/portal/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      if (!res.ok) {
        setMessages([...updated, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
        return;
      }

      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
        keepComposerVisible();
      }, 60);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shift-ai-shell mx-auto flex w-full max-w-3xl flex-col h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-8rem)] lg:h-[calc(100vh-4rem)]">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-heading font-extrabold text-text-primary sm:text-2xl">SHIFT AI</h1>
        <p className="text-sm text-text-secondary mt-1">
          Your personal coaching assistant - ask about training, your plan, or next steps.
        </p>
      </div>

      <div ref={threadRef} className="shift-ai-thread app-card-quiet flex-1 min-h-0 overflow-y-auto p-4 space-y-4 mb-3 rounded-[20px] sm:mb-4 sm:rounded-[24px] flex flex-col">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(224,64,208,0.1)] border border-[rgba(224,64,208,0.2)] flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">How can I help?</h2>
            <p className="text-sm text-text-muted max-w-md mb-6">
              I know your training plan, nutrition plan, check-ins and goals. Ask me anything.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {prompts.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-left text-sm text-text-secondary px-4 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[rgba(224,64,208,0.2)] hover:bg-[rgba(224,64,208,0.05)] transition-all duration-200 cursor-pointer min-h-[48px]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && <div className="flex-1" />}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`shift-ai-message flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent/20 text-text-primary rounded-br-md"
                  : "bg-[rgba(0,0,0,0.03)] text-text-secondary border border-[rgba(0,0,0,0.06)] rounded-bl-md"
              }`}
            >
              <div className="space-y-1.5">
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-accent-bright/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-accent-bright/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-accent-bright/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        ref={composerBarRef}
        className={`shift-ai-composer-bar ${composerFocused ? "is-focused" : ""}`}
      >
        <div className="relative">
        <AIComposerTextarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setComposerFocused(true);
            keepComposerVisible();
          }}
          onBlur={() => setComposerFocused(false)}
          onInput={() => keepComposerVisible()}
          placeholder="Ask SHIFT AI..."
          rows={1}
          disabled={loading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-accent-bright/20 hover:bg-accent-bright/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
        </div>
      </div>
    </div>
  );
}
