export type ClientSex = "female" | "male" | "prefer_not_to_say";
export type CyclePhase = "menstruation" | "late_follicular" | "ovulation" | "early_luteal" | "mid_luteal" | "late_luteal";
export type CycleTone = "neutral" | "go" | "steady";
export type CyclePromptKind = "phase_headsup" | "override_push" | "override_rootcause" | "symptom_honest" | "affirm" | "gp_note";

export type CycleSettings = {
  last_period_start: string | null;
  average_cycle_length: number;
  average_period_length: number;
};

export type DailyReadinessMetric = {
  tracked_date: string;
  sleep_hours: number | null;
  water_liters?: number | null;
  energy_level: number | null;
  stress_level: number | null;
  nutrition_score: number | null;
  training_completed: boolean;
};

export type CycleEntry = {
  tracked_date: string;
  flow: "none" | "spotting" | "light" | "medium" | "heavy";
  symptoms: string[];
  pain_level: number | null;
  energy_level: number | null;
  training_impact: "none" | "scaled" | "skipped";
  unusual_symptoms: boolean;
  notes: string | null;
};

export type CyclePromptEvent = {
  event_key: string;
  prompt_kind: CyclePromptKind | string;
  phase: CyclePhase | string | null;
  shown_on: string;
};

export type CyclePhaseInfo = {
  phase: CyclePhase;
  label: string;
  day: number;
  phaseStartedOn: string;
};

export type CyclePrompt = {
  kind: CyclePromptKind;
  eyebrow: string;
  tone: CycleTone;
  text: string;
  eventKey: string;
  phase?: CyclePhase;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const mismatchKinds: CyclePromptKind[] = ["override_push", "override_rootcause", "symptom_honest"];

export const phaseLabels: Record<CyclePhase, string> = {
  menstruation: "Menstruation",
  late_follicular: "Late follicular",
  ovulation: "Ovulation",
  early_luteal: "Early luteal",
  mid_luteal: "Mid luteal",
  late_luteal: "Late luteal",
};

const cyclePromptCopy = {
  phase_headsup: {
    eyebrow: "Heads up",
    tone: "neutral" as const,
    by_phase: {
      menstruation: [
        "Period's likely started. Your strength's still here - the science is clear on that. If cramps or fatigue show up, scale the load by feel and still get the work done.",
        "You're on your period this week. Not a week to write off. Train your plan - if you're sore or drained, trim the load, don't bin the session.",
        "Period week. Most of what you can lift, you can still lift. Show up, read your body, adjust by feel if you need to - but show up.",
      ],
      late_follicular: [
        "Energy usually runs well around now. No tricks needed - train hard and chase the numbers you set.",
        "Good stretch ahead for most. Nothing to manage here. Go execute and bank some quality sessions.",
        "This is a 'just train' week. Show up, do the work, push your progressions.",
      ],
      ovulation: [
        "You may feel strong this stretch. If it's there, use it. Let how you feel call it - not the date on a chart.",
        "Some feel a lift around now. Don't bank on it, don't ignore it - train to today, not the calendar.",
        "Mid-cycle. Feeling good? Go get it. If not, that's fine too. The phase doesn't decide - you do.",
      ],
      early_luteal: [
        "Nothing to flag yet. Train as normal and just clock how the sessions feel this week.",
        "Steady week. No changes. Keep an eye on how you're recovering as we move through it.",
        "Business as usual. Train your plan and stay honest about how you're feeling day to day.",
      ],
      mid_luteal: [
        "Some find sessions feel heavier around now. If the bar feels heavy, trust RPE - hold the load, don't bail.",
        "You're fully capable this week, even if it feels like harder work. Adjust by feel if you need to, keep the session.",
        "If training feels like more effort than the numbers say, that's normal. Scale the load, finish the work.",
      ],
      late_luteal: [
        "This is the common pre-period window. If symptoms hit, trim the load - not the session. If you feel fine, train fully. Your strength's still there.",
        "PMS week for a lot of women. Don't pull back on reflex. Feel good? Train hard. Feel rough? Scale by feel and still get it done.",
        "Pre-period stretch. Symptoms are real if they come - autoregulate. No symptoms? No reason to back off.",
      ],
    } satisfies Record<CyclePhase, string[]>,
  },
  override_push: {
    eyebrow: "Green light",
    tone: "go" as const,
    variants: [
      "Cycle-syncing would tell you to go light now. Your check-in says fresh. Ignore the calendar - push what you've got today.",
      "By the book you'd be 'meant' to ease off this week. You're not feeling it though - you're ready. So go. Move some weight.",
      "Don't let the phase talk you down. You've turned up fresh. This is a green light - train like it.",
      "The calendar says back off. Your body says go. Trust your body. Send it.",
    ],
  },
  override_rootcause: {
    eyebrow: "Read the room",
    tone: "steady" as const,
    variants: [
      "You'd expect to feel strong this week. You don't - and that's not your cycle. It's your {driver}. Don't write the session off: execute it, scale by RPE, tighten the basics.",
      "Feeling flat when you 'should' feel strong? Look past the cycle. Your {driver} is the real story this week. Get the work done at the load you've got, then fix the inputs.",
      "This isn't a hormone problem. It's {driver}. The training still happens - scale it to today and sort the cause.",
      "Don't blame the phase for this one. {driver} is what's draining you. Train to your honest level today, then go fix it.",
    ],
  },
  symptom_honest: {
    eyebrow: "Be honest with it",
    tone: "steady" as const,
    variants: [
      "Feeling flat's easy to pin on your cycle. Symptoms are real, so autoregulate - but your {driver} is likely the bigger factor. Trim the load, keep the session, fix the inputs.",
      "Yes, you might be premenstrual. But it's also your {driver}. Don't hand the cycle all the blame - scale by feel, get it done, then tighten what you control.",
      "Symptoms or not, {driver} is dragging you this week too. Honour how you feel, trim the load - but the session still happens and the inputs still get fixed.",
      "Be honest with it: part cycle, part {driver}. Autoregulate today, don't bail, and own the bits that are on you.",
    ],
  },
  affirm: {
    eyebrow: "Logged",
    tone: "go" as const,
    variants: [
      "Felt good, you were ready, you banked it. Nothing clever needed. Keep stacking these.",
      "That's what a ready body does. No phase magic - just turned up and executed. Logged.",
      "Good session off a good setup. This is the standard. Repeat it.",
    ],
  },
  gp_note: {
    eyebrow: "Worth a check",
    tone: "neutral" as const,
    variants: [
      "A heads-up, not coaching: if pain, bleeding or symptoms are severe or out of the ordinary for you, that's worth a word with your GP. Always better checked.",
    ],
  },
};

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number) {
  return toDateKey(new Date(parseDateKey(dateKey).getTime() + days * DAY_MS));
}

function daysBetween(from: string, to: string) {
  return Math.floor((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / DAY_MS);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function listPhrase(items: string[]) {
  if (items.length <= 1) return items[0] || "the basics";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function scoreReadiness(metric: DailyReadinessMetric | null | undefined) {
  if (!metric) return { score: null, driver: "the basics" };

  const factors: Array<{ label: string; value: number | null; weak: boolean }> = [
    {
      label: "sleep",
      value: metric.sleep_hours !== null ? Math.min(10, Math.max(1, (Number(metric.sleep_hours) / 8) * 10)) : null,
      weak: metric.sleep_hours !== null && Number(metric.sleep_hours) < 6.5,
    },
    {
      label: "energy",
      value: metric.energy_level,
      weak: metric.energy_level !== null && metric.energy_level <= 4,
    },
    {
      label: "stress",
      value: metric.stress_level !== null ? 11 - Number(metric.stress_level) : null,
      weak: metric.stress_level !== null && metric.stress_level >= 7,
    },
    {
      label: "nutrition",
      value: metric.nutrition_score,
      weak: metric.nutrition_score !== null && metric.nutrition_score <= 5,
    },
    {
      label: "training",
      value: metric.training_completed ? 10 : null,
      weak: false,
    },
  ];

  const values = factors.map((factor) => factor.value).filter((value): value is number => value !== null);
  const drivers = factors.filter((factor) => factor.weak).map((factor) => factor.label);

  return {
    score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    driver: listPhrase(drivers.length ? drivers : ["the basics"]),
  };
}

function pickVariant(variants: string[], kind: CyclePromptKind, events: CyclePromptEvent[], driver?: string) {
  const previousCount = events.filter((event) => event.prompt_kind === kind).length;
  return variants[previousCount % variants.length].replace("{driver}", driver || "the basics");
}

function hasEvent(events: CyclePromptEvent[], eventKey: string) {
  return events.some((event) => event.event_key === eventKey);
}

function mismatchCapReached(events: CyclePromptEvent[], todayKey: string) {
  const start = addDays(todayKey, -6);
  return events.filter((event) =>
    mismatchKinds.includes(event.prompt_kind as CyclePromptKind) && event.shown_on >= start
  ).length >= 2;
}

export function getCyclePhase(settings: CycleSettings | null | undefined, todayKey = toDateKey()): CyclePhaseInfo | null {
  if (!settings?.last_period_start) return null;

  const cycleLength = clamp(settings.average_cycle_length || 28, 21, 45);
  const periodLength = clamp(settings.average_period_length || 5, 2, 10);
  const elapsed = daysBetween(settings.last_period_start, todayKey);
  if (!Number.isFinite(elapsed)) return null;

  const day = ((elapsed % cycleLength) + cycleLength) % cycleLength + 1;
  const currentCycleStart = addDays(todayKey, -(day - 1));
  const ovulationStart = clamp(cycleLength - 15, periodLength + 1, cycleLength);
  const ovulationEnd = clamp(cycleLength - 12, ovulationStart, cycleLength);
  const lateLutealStart = clamp(cycleLength - 5, ovulationEnd + 1, cycleLength);
  const midLutealStart = clamp(Math.floor((ovulationEnd + lateLutealStart) / 2), ovulationEnd + 1, lateLutealStart);

  let phase: CyclePhase;
  let phaseStartDay: number;

  if (day <= periodLength) {
    phase = "menstruation";
    phaseStartDay = 1;
  } else if (day < ovulationStart) {
    phase = "late_follicular";
    phaseStartDay = periodLength + 1;
  } else if (day <= ovulationEnd) {
    phase = "ovulation";
    phaseStartDay = ovulationStart;
  } else if (day < midLutealStart) {
    phase = "early_luteal";
    phaseStartDay = ovulationEnd + 1;
  } else if (day < lateLutealStart) {
    phase = "mid_luteal";
    phaseStartDay = midLutealStart;
  } else {
    phase = "late_luteal";
    phaseStartDay = lateLutealStart;
  }

  return {
    phase,
    label: phaseLabels[phase],
    day,
    phaseStartedOn: addDays(currentCycleStart, phaseStartDay - 1),
  };
}

export function getCyclePrompt(params: {
  phaseInfo: CyclePhaseInfo | null;
  todayMetric?: DailyReadinessMetric | null;
  todayEntry?: CycleEntry | null;
  promptEvents: CyclePromptEvent[];
  todayKey?: string;
}): CyclePrompt | null {
  const todayKey = params.todayKey || toDateKey();
  const readiness = scoreReadiness(params.todayMetric);
  const phaseInfo = params.phaseInfo;
  const entry = params.todayEntry;

  if (entry?.unusual_symptoms || (entry?.pain_level ?? 0) >= 8) {
    const eventKey = `gp_note:${todayKey}`;
    if (!hasEvent(params.promptEvents, eventKey)) {
      const copy = cyclePromptCopy.gp_note;
      return { kind: "gp_note", eyebrow: copy.eyebrow, tone: copy.tone, text: pickVariant(copy.variants, "gp_note", params.promptEvents), eventKey };
    }
  }

  if (phaseInfo) {
    const phaseEventKey = `phase_headsup:${phaseInfo.phase}:${phaseInfo.phaseStartedOn}`;
    if (!hasEvent(params.promptEvents, phaseEventKey)) {
      const copy = cyclePromptCopy.phase_headsup;
      return {
        kind: "phase_headsup",
        eyebrow: `${copy.eyebrow} · ${phaseInfo.label}`,
        tone: copy.tone,
        text: pickVariant(copy.by_phase[phaseInfo.phase], "phase_headsup", params.promptEvents),
        eventKey: phaseEventKey,
        phase: phaseInfo.phase,
      };
    }
  }

  if (!phaseInfo || readiness.score === null || mismatchCapReached(params.promptEvents, todayKey)) return null;

  const highReadiness = readiness.score >= 8;
  const lowReadiness = readiness.score <= 5;
  const phaseSaysGo = phaseInfo.phase === "late_follicular" || phaseInfo.phase === "ovulation";
  const phaseSaysManage = phaseInfo.phase === "menstruation" || phaseInfo.phase === "mid_luteal" || phaseInfo.phase === "late_luteal";

  if (phaseSaysManage && highReadiness) {
    const copy = cyclePromptCopy.override_push;
    return {
      kind: "override_push",
      eyebrow: copy.eyebrow,
      tone: copy.tone,
      text: pickVariant(copy.variants, "override_push", params.promptEvents),
      eventKey: `override_push:${todayKey}`,
      phase: phaseInfo.phase,
    };
  }

  if (phaseSaysGo && lowReadiness) {
    const copy = cyclePromptCopy.override_rootcause;
    return {
      kind: "override_rootcause",
      eyebrow: copy.eyebrow,
      tone: copy.tone,
      text: pickVariant(copy.variants, "override_rootcause", params.promptEvents, readiness.driver),
      eventKey: `override_rootcause:${todayKey}`,
      phase: phaseInfo.phase,
    };
  }

  if (phaseSaysManage && lowReadiness && (entry?.symptoms?.length || entry?.flow !== "none")) {
    const copy = cyclePromptCopy.symptom_honest;
    return {
      kind: "symptom_honest",
      eyebrow: copy.eyebrow,
      tone: copy.tone,
      text: pickVariant(copy.variants, "symptom_honest", params.promptEvents, readiness.driver),
      eventKey: `symptom_honest:${todayKey}`,
      phase: phaseInfo.phase,
    };
  }

  if (entry?.training_impact === "none" && params.todayMetric?.training_completed && highReadiness) {
    const copy = cyclePromptCopy.affirm;
    return {
      kind: "affirm",
      eyebrow: copy.eyebrow,
      tone: copy.tone,
      text: pickVariant(copy.variants, "affirm", params.promptEvents),
      eventKey: `affirm:${todayKey}`,
      phase: phaseInfo.phase,
    };
  }

  return null;
}

export function isCycleEligible(profile: { sex?: string | null; cycle_tracking_enabled?: boolean | null } | null | undefined) {
  return profile?.sex === "female" && profile.cycle_tracking_enabled === true;
}
