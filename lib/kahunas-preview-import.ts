import { legacyProfileForProgramme, type ProgrammeType } from "@/lib/programmes";

export type ImportedExercise = {
  name: string;
  sets: number;
  reps: string;
  prescriptionType: "sets_reps" | "time" | "calories" | "rounds" | "amrap" | "distance" | "custom";
  prescriptionText: string;
  restSeconds: number | null;
  notes: string | null;
  sectionLabel: string | null;
  supersetGroup: string | null;
};

export type ImportedSession = {
  name: string;
  exercises: ImportedExercise[];
};

export type KahunasPreviewClient = {
  sourcePath: string;
  sourceMarkdown: string;
  name: string;
  email: string;
  programme: ProgrammeType;
  programmeSourceValid: boolean;
  profile: ReturnType<typeof legacyProfileForProgramme>;
  checkinDay: string | null;
  startWeightKg: number | null;
  latestWeightKg: number | null;
  latestWeightDate: string | null;
  macros: { calories: number; protein: number; carbs: number; fat: number } | null;
  trainingPlanName: string | null;
  trainingPlanDeclared: boolean;
  sessions: ImportedSession[];
  consultationData: Record<string, string>;
  flags: string[];
};

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;

function tableValue(markdown: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|\\n]+?)\\s*\\|`, "im"))?.[1]?.trim() || null;
}

function programmeFromPath(sourcePath: string): ProgrammeType | null {
  const normalized = `/${sourcePath.toLowerCase().replace(/^\/+/, "")}`;
  if (normalized.includes("/capacity/")) return "capacity";
  if (normalized.includes("/in-person/")) return "in_person";
  if (normalized.includes("/shift/")) return "shift";
  return null;
}

function programmeFromTier(value: string | null): ProgrammeType | null {
  const normalized = value?.toLowerCase().trim() || "";
  if (normalized.startsWith("capacity")) return "capacity";
  if (normalized.startsWith("shift")) return "shift";
  if (normalized.startsWith("in person")) return "in_person";
  return null;
}

function weightKg(value: string | null) {
  if (!value) return null;
  const number = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(number)) return null;
  return Number((/\blb/i.test(value) ? number * 0.45359237 : number).toFixed(1));
}

function parseRestSeconds(value: string) {
  if (!value || value === "-") return null;
  const minutes = Number(value.match(/(\d+)\s*min/i)?.[1] || 0);
  const seconds = Number(value.match(/(\d+)\s*sec/i)?.[1] || 0);
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function parsePrescription(reps: string, notes: string) {
  const source = reps || notes;
  if (/\bcal(?:orie)?s?\b/i.test(source)) return { type: "calories" as const, text: source };
  if (/\brounds?\b/i.test(source)) return { type: "rounds" as const, text: source };
  if (/\bamrap\b/i.test(source)) return { type: "amrap" as const, text: source };
  if (/\d+(?:\.\d+)?\s*(?:km|kilomet(?:er|re)s?|miles?|met(?:er|re)s?|m)\b/i.test(source)) return { type: "distance" as const, text: source };
  const time = source.match(/(?:time\s*)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)(?:\s*(?:and\s*)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?))*/i)?.[0];
  if (time) return { type: "time" as const, text: source.replace(/^time\s*/i, "") };
  if (reps) return { type: "sets_reps" as const, text: reps };
  return { type: "custom" as const, text: notes || "Review source prescription" };
}

function parseMacros(markdown: string) {
  const section = markdown.match(/## Macros[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] || "";
  const row = section.match(/^\|\s*(\d+)\s*kcal\s*\|\s*(\d+)\s*g\s*\|\s*(\d+)\s*g\s*\|\s*(\d+)\s*g\s*\|/im);
  if (!row) return null;
  return { calories: Number(row[1]), protein: Number(row[2]), carbs: Number(row[3]), fat: Number(row[4]) };
}

function markdownTableCells(line: string) {
  const splitCells = line.split("|");
  if (splitCells[0].trim() === "") splitCells.shift();
  if (splitCells.at(-1)?.trim() === "") splitCells.pop();
  return splitCells.map((cell) => cell.trim());
}

function isMarkdownSeparator(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTraining(markdown: string) {
  const heading = markdown.match(/## Current training plan\s*[—-]\s*[“"]([^”"]+)[”"]/i);
  const section = markdown.match(/## Current training plan[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] || "";
  const sessions: ImportedSession[] = [];
  const headings = [...section.matchAll(/^###\s+(.+)$/gm)];

  for (let index = 0; index < headings.length; index += 1) {
    const start = (headings[index].index || 0) + headings[index][0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : section.length;
    const body = section.slice(start, end);
    const exercises: ImportedExercise[] = [];
    let sectionLabel: string | null = null;

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      const label = line.match(/^\*\*([^*]+)\*\*$/)?.[1]?.trim();
      if (label) {
        sectionLabel = label;
        continue;
      }
      if (!line.startsWith("|")) continue;
      const cells = markdownTableCells(line);
      if (isMarkdownSeparator(cells) || cells[0] === "#") continue;
      if (cells.length < 7 || cells[1].toLowerCase() === "exercise") continue;
      const exerciseName = cells[1];
      if (!exerciseName) continue;
      const sets = Math.max(1, Number.parseInt(cells[2], 10) || 1);
      const rir = cells[4] ? `RIR: ${cells[4]}` : "";
      const notes = [rir, cells[6], cells.slice(7).join(" | ")].filter(Boolean).join(" | ") || null;
      const prescription = parsePrescription(cells[3], notes || "");
      const supersetGroup = /superset/i.test(cells[0]) ? cells[0].match(/[A-Za-z]+/)?.[0] || null : null;
      exercises.push({
        name: exerciseName,
        sets,
        reps: cells[3] || "As prescribed",
        prescriptionType: prescription.type,
        prescriptionText: prescription.text,
        restSeconds: parseRestSeconds(cells[5]),
        notes,
        sectionLabel,
        supersetGroup,
      });
      sectionLabel = null;
    }

    if (exercises.length > 0) sessions.push({ name: headings[index][1].trim(), exercises });
  }

  if (sessions.length === 0) {
    for (const rawLine of section.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("|")) continue;
      const cells = markdownTableCells(line);
      if (isMarkdownSeparator(cells) || /^day$/i.test(cells[0])) continue;
      const [day, activity, detail] = cells;
      if (!day || !activity || !detail) continue;
      const prescription = parsePrescription(detail, "");
      sessions.push({
        name: day,
        exercises: [{
          name: activity,
          sets: 1,
          reps: detail,
          prescriptionType: prescription.type,
          prescriptionText: prescription.text,
          restSeconds: null,
          notes: null,
          sectionLabel: null,
          supersetGroup: null,
        }],
      });
    }
  }
  return { name: heading?.[1]?.trim() || null, sessions, declared: Boolean(heading) };
}

function keyForQuestion(question: string, index: number) {
  const normalized = question.toLowerCase().replace(/[’'"“”]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return normalized.slice(0, 64) || `question_${index + 1}`;
}

function canonicalQuestionId(question: string, index: number) {
  const normalized = question.toLowerCase().replace(/[’'"“”]/g, "");
  if (/the now|where are you at right now/.test(normalized)) return "hierarchy_now";
  if (/the past|held you back|setbacks/.test(normalized)) return "hierarchy_past";
  if (/your support|support network/.test(normalized)) return "hierarchy_support";
  if (/the future|your goals|primary goal|what are your goals/.test(normalized)) return "primary_goal";
  if (/injur|limitation/.test(normalized)) return "injuries";
  if (/supplement/.test(normalized)) return "supplements";
  if (/dietary|food preference|nutrition preference/.test(normalized)) return "dietary_preferences";
  if (/equipment|train at home|train in a gym|sessions a week|how many sessions/.test(normalized)) return "hierarchy_exercise_nutrition";
  if (/occupation|tell me about you/.test(normalized)) return "hierarchy_you";
  return keyForQuestion(question, index);
}

function parseConsultation(markdown: string) {
  const section = markdown.match(/## Consultation form[^\n]*\n([\s\S]*)$/i)?.[1] || "";
  const answers: Record<string, string> = {};
  const questions = [...section.matchAll(/^\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/gm)];
  questions.forEach((match, index) => {
    const value = match[2].trim();
    if (!value || value === "(blank)") return;
    const key = canonicalQuestionId(match[1], index);
    const labelled = `${match[1].trim()}: ${value}`;
    answers[key] = answers[key] ? `${answers[key]}\n\n${labelled}` : value;
  });
  return answers;
}

function parseFlags(markdown: string) {
  const section = markdown.match(/## Flags\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] || "";
  return section.split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

export function normaliseExerciseName(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function parseKahunasPreviewClient(sourcePath: string, markdown: string): KahunasPreviewClient {
  const name = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  const emailRaw = tableValue(markdown, "Login email") || "";
  const email = emailRaw.match(EMAIL_PATTERN)?.[0]?.toLowerCase() || "";
  const pathProgramme = programmeFromPath(sourcePath);
  const tierProgramme = programmeFromTier(tableValue(markdown, "Tier"));
  const programme = pathProgramme || tierProgramme || "shift";
  const latestWeight = tableValue(markdown, "Latest check-in weight");
  const latestWeightDate = latestWeight?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] || null;
  const training = parseTraining(markdown);

  return {
    sourcePath,
    sourceMarkdown: markdown,
    name,
    email,
    programme,
    programmeSourceValid: pathProgramme !== null && tierProgramme === pathProgramme,
    profile: legacyProfileForProgramme(programme),
    checkinDay: tableValue(markdown, "Check-in day")?.replace(/\*/g, "").toLowerCase() || null,
    startWeightKg: weightKg(tableValue(markdown, "Kahunas start weight")),
    latestWeightKg: weightKg(latestWeight),
    latestWeightDate,
    macros: parseMacros(markdown),
    trainingPlanName: training.name,
    trainingPlanDeclared: training.declared,
    sessions: training.sessions,
    consultationData: parseConsultation(markdown),
    flags: parseFlags(markdown),
  };
}

export function validateKahunasPreviewClients(clients: KahunasPreviewClient[]) {
  const issues: string[] = [];
  if (clients.length === 0) issues.push("Archive contains no Markdown client files.");
  const emails = new Set<string>();
  for (const client of clients) {
    if (!client.name) issues.push(`${client.sourcePath}: missing client name`);
    if (!EMAIL_PATTERN.test(client.email)) issues.push(`${client.sourcePath}: missing valid login email`);
    if (emails.has(client.email)) issues.push(`${client.sourcePath}: duplicate login email`);
    emails.add(client.email);
    if (!client.programmeSourceValid) issues.push(`${client.sourcePath}: programme folder and Tier row are missing or do not match`);
    if (client.trainingPlanDeclared && client.sessions.length === 0) issues.push(`${client.sourcePath}: declared training plan did not produce any sessions`);
  }
  return issues;
}
