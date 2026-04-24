"use client";

import { useState, useEffect, useRef } from "react";

// ============================================
// QUESTIONS — Adapted from Dr John Demartini's
// Value Determination Process, SHIFT voice
// ============================================

const QUESTIONS = [
  {
    id: 1,
    title: "Your space",
    short: "Space",
    prompt: "Look at your home environment now. What's in there you'd never let go of?",
    hint: "Books, gym gear, tech, photos, business stuff, health kit.",
  },
  {
    id: 2,
    title: "Your time",
    short: "Time",
    prompt: "When nobody's watching, what do you always make time for — even when life gets busy? Not what you think you should do. What actually happens.",
    hint: "Your calendar doesn't lie. What fills it without you forcing it?",
  },
  {
    id: 3,
    title: "Your energy",
    short: "Energy",
    prompt: "What gives you energy rather than drains it? What could you do for hours and still feel switched on?",
    hint: "Where do you lose track of time? When do you not check the clock?",
  },
  {
    id: 4,
    title: "Your money",
    short: "Money",
    prompt: "Where does your money actually go? What do you buy or invest in without hesitation?",
    hint: "Check your bank. Materials, courses, equipment, subscriptions.",
  },
  {
    id: 5,
    title: "Your order",
    short: "Order",
    prompt: "Where in your life is everything dialled — structured, organised? Chaos lives where it doesn't matter to you.",
    hint: "Training plan? Finances? Calendar? Wardrobe? Business systems?",
  },
  {
    id: 6,
    title: "Your discipline",
    short: "Discipline",
    prompt: "What don't you need push or reminders for? These things just happen — reliably, consistently, without anyone telling you.",
    hint: "The stuff that runs on autopilot. No willpower needed.",
  },
  {
    id: 7,
    title: "Your thoughts",
    short: "Thoughts",
    prompt: "Think about your inner world. What fills your head first thing in the morning, last thing at night?",
    hint: "Not worries — the things your mind naturally gravitates toward.",
  },
  {
    id: 8,
    title: "Your vision",
    short: "Vision",
    prompt: "What do you visualise for yourself? The images that keep building — your inner vision of where you're heading.",
    hint: "What does the future version of you look like? What are they doing?",
  },
  {
    id: 9,
    title: "Your talk",
    short: "Talk",
    prompt: "What conversation topics do you bring up most? The stuff you talk about out loud with people you trust.",
    hint: "Topics you steer every conversation toward, even when it's not relevant.",
  },
  {
    id: 10,
    title: "Your inspiration",
    short: "Inspiration",
    prompt: "Who's inspiring you right now? What achievements, causes, or people genuinely stir something in you?",
    hint: "Who would you want to be? What about them fires you up?",
  },
  {
    id: 11,
    title: "Your goals",
    short: "Goals",
    prompt: "Your long game goals. The ones that stay regardless of what else might come and go.",
    hint: "Not this month's targets — the 3-year, 5-year vision that won't quit.",
  },
  {
    id: 12,
    title: "Your learning",
    short: "Learning",
    prompt: "Name 3 subjects you love to study. YouTube rabbit holes, podcasts, books you can't put down.",
    hint: "What would you learn about even if nobody paid you to?",
  },
  {
    id: 13,
    title: "Your persistence",
    short: "Persistence",
    prompt: "What have you been most consistent with through everything — career changes, life events, moves? What always stays?",
    hint: "The thread that runs through your whole life, no matter what.",
  },
];

const QUESTION_MAP: Record<number, (typeof QUESTIONS)[0]> = {};
QUESTIONS.forEach((q) => { QUESTION_MAP[q.id] = q; });

// ============================================
// ANALYSIS ENGINE
// ============================================

interface AnalysedValue {
  rank: number;
  label: string;
  breadth: number;
  questionIds: number[];
  entries: { text: string; qId: number }[];
}

function analyseValues(entries: Record<string, string[]>): AnalysedValue[] {
  const allAnswers: { text: string; qId: number; words: string[] }[] = [];
  for (const [qId, answers] of Object.entries(entries)) {
    for (const answer of answers) {
      const trimmed = answer.trim();
      if (!trimmed) continue;
      allAnswers.push({
        text: trimmed,
        qId: parseInt(qId),
        words: trimmed.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2),
      });
    }
  }

  const groups: { entries: { text: string; qId: number }[]; questionIds: Set<number>; label: string }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < allAnswers.length; i++) {
    if (used.has(i)) continue;
    const group = {
      entries: [{ text: allAnswers[i].text, qId: allAnswers[i].qId }],
      questionIds: new Set([allAnswers[i].qId]),
      label: allAnswers[i].text,
    };
    for (let j = i + 1; j < allAnswers.length; j++) {
      if (used.has(j)) continue;
      const wordsA = new Set(allAnswers[i].words);
      const wordsB = new Set(allAnswers[j].words);
      let shared = 0;
      for (const w of wordsB) { if (wordsA.has(w)) shared++; }
      const minSize = Math.min(wordsA.size, wordsB.size);
      if (minSize > 0 && shared / minSize >= 0.35) {
        group.entries.push({ text: allAnswers[j].text, qId: allAnswers[j].qId });
        group.questionIds.add(allAnswers[j].qId);
        used.add(j);
      }
    }
    used.add(i);
    groups.push(group);
  }

  return groups
    .sort((a, b) => {
      const bq = b.questionIds.size - a.questionIds.size;
      return bq !== 0 ? bq : b.entries.length - a.entries.length;
    })
    .slice(0, 8)
    .map((g, i) => ({
      rank: i + 1,
      label: g.label.charAt(0).toUpperCase() + g.label.slice(1),
      breadth: g.questionIds.size,
      questionIds: Array.from(g.questionIds).sort((a, b) => a - b),
      entries: g.entries,
    }));
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full h-1 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
      <div className="h-full bg-accent rounded-full transition-all duration-500 ease-out" style={{ width: `${(current / total) * 100}%` }} />
    </div>
  );
}

function QuestionCard({ question, answers, onUpdate, onNext, onBack, canGoNext, index, total }: {
  question: (typeof QUESTIONS)[0]; answers: string[]; onUpdate: (i: number, val: string) => void;
  onNext: () => void; onBack: () => void; canGoNext: boolean; index: number; total: number;
}) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  useEffect(() => { refs[0].current?.focus(); }, [question.id]);

  return (
    <div className="flex flex-col min-h-[50vh] justify-center max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-text-muted font-mono">{index + 1} / {total}</span>
        <span className="text-xs text-text-muted">{question.short}</span>
      </div>
      <h2 className="text-xl sm:text-2xl font-heading font-bold text-text-primary leading-tight mb-3">{question.prompt}</h2>
      <p className="text-sm text-text-muted italic mb-8">{question.hint}</p>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] text-accent font-bold">{i + 1}</div>
            <input ref={refs[i]} value={answers[i]} type="text"
              onChange={(e) => onUpdate(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (i < 2) refs[i + 1]?.current?.focus(); else if (canGoNext) onNext(); } }}
              placeholder={i === 0 ? "First thing that comes to mind..." : i === 1 ? "Second..." : "Third..."}
              className="w-full pl-11 pr-4 py-3.5 bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl text-sm text-text-primary placeholder:text-text-muted/40 focus:border-accent/40 focus:outline-none transition-colors"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className={`text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer ${index === 0 ? "invisible" : ""}`}>Back</button>
        <button onClick={onNext} disabled={!canGoNext} className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-all cursor-pointer">
          {index === total - 1 ? "See My Values" : "Next"}
        </button>
      </div>
    </div>
  );
}

function AlignmentBadge({ score }: { score: number }) {
  const config = score >= 50
    ? { label: "Your values run deep", desc: "Your top three show up across most areas of your life. That's a strong base to build on.", color: "#1D9E75", bg: "rgba(29,158,117,0.1)", border: "rgba(29,158,117,0.3)" }
    : score >= 30
    ? { label: "A few strong pillars", desc: "Your top values are clear in some areas but not yet across the board. Room to let them lead more.", color: "#EF9F27", bg: "rgba(239,159,39,0.1)", border: "rgba(239,159,39,0.3)" }
    : { label: "Still coming into focus", desc: "No judgment here. Most people find these spread out before they find their true centre. This is the starting map.", color: "#7C5CF0", bg: "rgba(124,92,240,0.1)", border: "rgba(124,92,240,0.3)" };

  return (
    <div className="text-center mb-8">
      <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="text-4xl font-heading font-bold" style={{ color: config.color }}>{score}%</div>
        <div className="text-sm font-semibold" style={{ color: config.color }}>{config.label}</div>
        <div className="text-xs text-text-muted max-w-xs leading-relaxed">{config.desc}</div>
      </div>
    </div>
  );
}

function ResultsView({ values, alignmentScore, onRestart, saving }: {
  values: AnalysedValue[]; alignmentScore: number; onRestart: () => void; saving: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const top3 = values.slice(0, 3);
  const rest = values.slice(3);

  function toggleExpand(rank: number) {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(rank)) next.delete(rank); else next.add(rank); return next; });
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary text-center mb-2">Your values map</h1>
      <p className="text-sm text-text-muted text-center mb-8 max-w-md mx-auto leading-relaxed">Built from 39 of your own answers. Not a personality test — a mirror of what already drives your days.</p>

      <div className="mb-8">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider text-center mb-4">How concentrated your values are</h2>
        <AlignmentBadge score={alignmentScore} />
      </div>

      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Your top three drivers</h2>
      <div className="space-y-3 mb-8">
        {top3.map((v) => (
          <div key={v.rank} className="bg-bg-card border border-[rgba(224,64,208,0.15)] rounded-2xl overflow-hidden">
            <button onClick={() => toggleExpand(v.rank)} className="w-full flex items-center gap-4 p-5 text-left cursor-pointer hover:bg-[rgba(224,64,208,0.03)] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">{v.rank}</div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-text-primary text-base">{v.label}</div>
                <div className="text-xs text-text-muted mt-0.5">Present in {v.breadth} of 13 areas</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex gap-1">
                  {QUESTIONS.map((q) => (<div key={q.id} className={`w-2 h-2 rounded-full ${v.questionIds.includes(q.id) ? "bg-accent" : "bg-[rgba(255,255,255,0.06)]"}`} />))}
                </div>
                <svg className={`w-4 h-4 text-text-muted transition-transform ${expanded.has(v.rank) ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {expanded.has(v.rank) && (
              <div className="border-t border-[rgba(255,255,255,0.04)] p-5 space-y-4">
                <div>
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">EVIDENCE TRAIL</div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.questionIds.map((qId) => (<span key={qId} className="text-[10px] px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">{QUESTION_MAP[qId]?.short}</span>))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">EXACT ANSWERS</div>
                  <div className="space-y-1.5">
                    {v.entries.map((e, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-[10px] text-text-muted mt-0.5">{QUESTION_MAP[e.qId]?.short}:</span>
                        <span className="text-text-secondary">&ldquo;{e.text}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Also showing up</h2>
          <div className="space-y-2 mb-8">
            {rest.map((v) => (
              <div key={v.rank} className="bg-bg-card/60 border border-[rgba(255,255,255,0.04)] rounded-xl p-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[rgba(255,255,255,0.04)] flex items-center justify-center text-text-muted text-xs font-bold">{v.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-secondary">{v.label}</div>
                  <div className="text-[10px] text-text-muted">Present in {v.breadth} of 13 areas</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-8">
        <h2 className="font-heading font-bold text-text-primary mb-3">Why this matters</h2>
        <div className="text-sm text-text-secondary leading-relaxed space-y-3">
          <p>This isn&apos;t a score to pass or fail. It&apos;s a mirror of what already drives you when nobody&apos;s watching.</p>
          <p>Goals that line up with your top values rarely need willpower. Goals that don&apos;t tend to slip — not because you&apos;re weak, but because they&apos;re fighting how you&apos;re already wired.</p>
          <p>Your programme gets built against these. Training, nutrition, and mindset start landing easier once they stop fighting the map.</p>
        </div>
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Next step</h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">Screenshot this or come back any time — we&apos;ll map it against your goals in your next session so your plan matches the wiring, not the wishlist.</p>
        <button onClick={onRestart} className="px-6 py-3 bg-bg-card border border-[rgba(255,255,255,0.08)] text-text-secondary text-sm font-medium rounded-xl hover:border-accent/30 transition-all cursor-pointer">
          Retake exercise
        </button>
        {saving && <p className="text-xs text-text-muted">Saving your results...</p>}
      </div>
    </div>
  );
}

// ============================================
// MAIN EXERCISE COMPONENT
// ============================================

type Phase = "ready" | "questions" | "analysing" | "results";

export default function ValuesExercise() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    QUESTIONS.forEach((q) => { init[q.id] = ["", "", ""]; });
    return init;
  });
  const [values, setValues] = useState<AnalysedValue[]>([]);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    fetch("/api/portal/values-determination")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.results) setHasExisting(true); })
      .catch(() => {});
  }, []);

  function updateAnswer(qId: number, index: number, value: string) {
    setAnswers((prev) => { const updated = { ...prev }; updated[qId] = [...updated[qId]]; updated[qId][index] = value; return updated; });
  }

  function canProgress(): boolean {
    return answers[QUESTIONS[currentQ].id][0].trim().length > 0;
  }

  function handleNext() {
    if (currentQ < QUESTIONS.length - 1) setCurrentQ(currentQ + 1);
    else runAnalysis();
  }

  function handleBack() {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  }

  async function runAnalysis() {
    setPhase("analysing");
    await new Promise((r) => setTimeout(r, 1500));
    const result = analyseValues(answers);
    setValues(result);
    const top3 = result.slice(0, 3);
    const avg = top3.length > 0 ? top3.reduce((s, v) => s + v.breadth, 0) / (top3.length * 13) : 0;
    const score = Math.round(avg * 100);
    setAlignmentScore(score);
    setPhase("results");
    setSaving(true);
    try {
      await fetch("/api/portal/values-determination", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, valuesHierarchy: result, alignmentScore: score }),
      });
    } catch { /* non-critical */ } finally { setSaving(false); }
  }

  function handleRestart() {
    const init: Record<string, string[]> = {};
    QUESTIONS.forEach((q) => { init[q.id] = ["", "", ""]; });
    setAnswers(init);
    setCurrentQ(0);
    setValues([]);
    setAlignmentScore(0);
    setPhase("ready");
  }

  if (phase === "ready") {
    return (
      <div className="mt-8 border-t border-[rgba(255,255,255,0.06)] pt-8">
        <div className="bg-bg-card border border-[rgba(224,64,208,0.15)] rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-bold text-text-primary text-lg mb-2">Values Determination Exercise</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-1">
                13 evidence-based questions. 3 answers each. The tool cross-references all 39 answers to reveal what actually drives you.
              </p>
              <div className="flex items-center gap-4 text-xs text-text-muted mt-3 mb-4">
                <span>15-20 minutes</span>
                <span>13 questions</span>
              </div>
              {hasExisting && (
                <p className="text-xs text-text-muted mb-3">You&apos;ve completed this before. Starting again saves a new set of results.</p>
              )}
              <button onClick={() => setPhase("questions")} className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 transition-all cursor-pointer">
                {hasExisting ? "Retake Exercise" : "Start Exercise"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "questions") {
    return (
      <div className="mt-8 border-t border-[rgba(255,255,255,0.06)] pt-6">
        <div className="mb-6"><ProgressBar current={currentQ + 1} total={QUESTIONS.length} /></div>
        <QuestionCard question={QUESTIONS[currentQ]} answers={answers[QUESTIONS[currentQ].id]}
          onUpdate={(i, val) => updateAnswer(QUESTIONS[currentQ].id, i, val)}
          onNext={handleNext} onBack={handleBack} canGoNext={canProgress()} index={currentQ} total={QUESTIONS.length}
        />
      </div>
    );
  }

  if (phase === "analysing") {
    return (
      <div className="mt-8 flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-text-muted">Analysing your answers...</p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-[rgba(255,255,255,0.06)] pt-6">
      <ResultsView values={values} alignmentScore={alignmentScore} onRestart={handleRestart} saving={saving} />
    </div>
  );
}
