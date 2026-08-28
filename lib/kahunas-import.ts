import { isProgrammeType, type ProgrammeType } from "@/lib/programmes";

export type KahunasHandoverInput = {
  rowNumber: number;
  clientName: string;
  email: string;
  programme: string;
  startDate: string;
  phone: string;
  mainGoal: string;
  context: string;
  driveFolderUrl: string;
  missingNotes: string;
};

export type KahunasHandoverRecord = Omit<KahunasHandoverInput, "programme"> & {
  programme: ProgrammeType;
};

export type KahunasImportIssue = {
  rowNumber: number;
  field: keyof KahunasHandoverInput | "row";
  severity: "error" | "warning";
  message: string;
};

export const KAHUNAS_HANDOVER_HEADERS = [
  "Client name*",
  "Email*",
  "Programme*",
  "Start date",
  "Phone",
  "Main goal",
  "Injuries / important context",
  "Google Drive export folder link*",
  "Anything missing?",
  "Ready?",
] as const;

export const KAHUNAS_EXPECTED_EXPORTS = [
  "client profile or consultation",
  "current training plan",
  "exercise prescriptions",
  "workout history",
  "check-ins and trackers",
  "measurements",
  "progress photos",
  "nutrition plan or targets",
  "useful client documents",
] as const;

function normaliseProgramme(value: string): ProgrammeType | null {
  const candidate = value.trim().toLowerCase().replace(/\s+/g, "_");
  return isProgrammeType(candidate) ? candidate : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPrivateDriveFolderUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com" && url.pathname.includes("/folders/");
  } catch {
    return false;
  }
}

function isValidDate(value: string) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

export function validateKahunasHandover(rows: KahunasHandoverInput[]) {
  const issues: KahunasImportIssue[] = [];
  const records: KahunasHandoverRecord[] = [];
  const emailRows = new Map<string, number>();

  for (const row of rows) {
    const clientName = row.clientName.trim();
    const email = row.email.trim().toLowerCase();
    const programme = normaliseProgramme(row.programme);
    const driveFolderUrl = row.driveFolderUrl.trim();

    if (!clientName) issues.push({ rowNumber: row.rowNumber, field: "clientName", severity: "error", message: "Client name is required." });
    if (!email || !isValidEmail(email)) issues.push({ rowNumber: row.rowNumber, field: "email", severity: "error", message: "Enter a valid client email." });
    if (!programme) issues.push({ rowNumber: row.rowNumber, field: "programme", severity: "error", message: "Choose SHIFT, CAPACITY or IN PERSON." });
    if (!driveFolderUrl || !isPrivateDriveFolderUrl(driveFolderUrl)) issues.push({ rowNumber: row.rowNumber, field: "driveFolderUrl", severity: "error", message: "Paste one Google Drive folder link for this client." });
    if (!isValidDate(row.startDate)) issues.push({ rowNumber: row.rowNumber, field: "startDate", severity: "error", message: "Start date is not a valid date." });
    if (!row.mainGoal.trim()) issues.push({ rowNumber: row.rowNumber, field: "mainGoal", severity: "warning", message: "Main goal is blank; confirm it from the consultation or export folder." });

    if (email) {
      const previousRow = emailRows.get(email);
      if (previousRow) {
        issues.push({ rowNumber: row.rowNumber, field: "email", severity: "error", message: `This email is already used on row ${previousRow}.` });
      } else {
        emailRows.set(email, row.rowNumber);
      }
    }

    if (clientName && isValidEmail(email) && programme && isPrivateDriveFolderUrl(driveFolderUrl) && isValidDate(row.startDate)) {
      records.push({
        ...row,
        clientName,
        email,
        programme,
        driveFolderUrl,
        startDate: row.startDate.trim(),
        phone: row.phone.trim(),
        mainGoal: row.mainGoal.trim(),
        context: row.context.trim(),
        missingNotes: row.missingNotes.trim(),
      });
    }
  }

  const errorRows = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.rowNumber));
  return {
    records: records.filter((record) => !errorRows.has(record.rowNumber)),
    issues,
    summary: {
      totalRows: rows.length,
      readyRows: records.filter((record) => !errorRows.has(record.rowNumber)).length,
      rowsWithErrors: errorRows.size,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
    },
  };
}
