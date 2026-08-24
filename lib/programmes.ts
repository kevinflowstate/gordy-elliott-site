export const PROGRAMME_TYPES = ["capacity", "shift", "in_person"] as const;

export type ProgrammeType = (typeof PROGRAMME_TYPES)[number];
export type OnboardingStatus = "invited" | "consultation_complete" | "active" | "paused";

export const programmeConfig: Record<ProgrammeType, {
  label: string;
  callCount: number;
  callLabel: string;
  bookingUrl: string | null;
  documentsEnabled: boolean;
  aiMonthlyLimit: number | null;
}> = {
  capacity: {
    label: "CAPACITY",
    callCount: 2,
    callLabel: "Book your coaching call",
    bookingUrl: "https://calendly.com/gordyonline/at-capacity-1-1-call",
    documentsEnabled: true,
    aiMonthlyLimit: null,
  },
  shift: {
    label: "SHIFT",
    callCount: 1,
    callLabel: "Book your monthly client chat",
    bookingUrl: "https://calendly.com/gordyonline/client-chat",
    documentsEnabled: false,
    aiMonthlyLimit: 30,
  },
  in_person: {
    label: "IN PERSON",
    callCount: 1,
    callLabel: "Confirm your monthly 1:1",
    bookingUrl: null,
    documentsEnabled: true,
    aiMonthlyLimit: null,
  },
};

export function isProgrammeType(value: unknown): value is ProgrammeType {
  return typeof value === "string" && PROGRAMME_TYPES.includes(value as ProgrammeType);
}

export function normalizeProgrammeType(value: unknown): ProgrammeType {
  return isProgrammeType(value) ? value : "capacity";
}

export function parseProgrammeAudiences(value: unknown): ProgrammeType[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isProgrammeType)) return null;
  return [...new Set(value)];
}

export function programmeAllowsDocuments(value: unknown) {
  return programmeConfig[normalizeProgrammeType(value)].documentsEnabled;
}

export function legacyProfileForProgramme(programme: ProgrammeType) {
  if (programme === "capacity") return { tier: "vip", experience_mode: "founder_dashboard" } as const;
  if (programme === "shift") return { tier: "coached", experience_mode: "ai_coaching" } as const;
  return { tier: "premium", experience_mode: "ai_coaching" } as const;
}

export function monthStartKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not resolve the coaching month");
  return `${year}-${month}-01`;
}
