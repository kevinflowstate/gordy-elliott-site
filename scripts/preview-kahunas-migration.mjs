import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { KAHUNAS_EXPECTED_EXPORTS, KAHUNAS_HANDOVER_HEADERS, validateKahunasHandover } from "../lib/kahunas-import.ts";

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith("--")) return [String(index), arg];
  const [key, inline] = arg.slice(2).split("=", 2);
  const next = all[index + 1];
  return [key, inline ?? (next && !next.startsWith("--") ? next : true)];
}));

if (args.apply || args.commit || args.import) {
  throw new Error("This tool is validation-only. It cannot create accounts or write migration data.");
}

const inputPath = typeof args.input === "string" ? path.resolve(args.input) : null;
if (!inputPath) throw new Error("Usage: npm run migration:preview -- --input /path/to/AT-CAPACITY-Kahunas-Client-Handover.xlsx");
const outputPath = typeof args.output === "string"
  ? path.resolve(args.output)
  : path.resolve("output/kahunas-migration-preview.json");

const stat = await fs.stat(inputPath);
if (stat.size < 1 || stat.size > 5 * 1024 * 1024) throw new Error("The handover workbook must be under 5MB.");

function unzipText(entry) {
  return execFileSync("unzip", ["-p", inputPath, entry], { encoding: "utf8", maxBuffer: 12 * 1024 * 1024 });
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const workbookXml = unzipText("xl/workbook.xml");
const sheetTag = [...workbookXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/>/g)]
  .find((match) => /\bname="Client Handover"/.test(match[1]));
if (!sheetTag) throw new Error("The workbook must contain the Client Handover sheet.");
const relationshipId = sheetTag[1].match(/\br:id="([^"]+)"/)?.[1];
if (!relationshipId) throw new Error("The Client Handover sheet relationship is missing.");
const relationshipsXml = unzipText("xl/_rels/workbook.xml.rels");
const relationship = [...relationshipsXml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/>/g)]
  .find((match) => new RegExp(`\\bId="${relationshipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(match[1]));
const target = relationship?.[1].match(/\bTarget="([^"]+)"/)?.[1];
if (!target) throw new Error("The Client Handover sheet target is missing.");
const sheetEntry = target.startsWith("/") ? target.slice(1) : path.posix.join("xl", target);
const sheetXml = unzipText(sheetEntry);

let sharedStrings = [];
try {
  const sharedXml = unzipText("xl/sharedStrings.xml");
  sharedStrings = [...sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) =>
    [...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
} catch {
  sharedStrings = [];
}

const cellValues = new Map();
for (const match of sheetXml.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
  const address = match[1].match(/\br="([A-Z]+\d+)"/)?.[1];
  if (!address) continue;
  const type = match[1].match(/\bt="([^"]+)"/)?.[1];
  const body = match[2] || "";
  const raw = body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1]
    ?? body.match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1]
    ?? "";
  const decoded = decodeXml(raw);
  cellValues.set(address, type === "s" ? sharedStrings[Number(decoded)] || "" : decoded);
}

const cellText = (column, row) => String(cellValues.get(`${column}${row}`) || "").trim();
const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const headers = columns.map((column) => cellText(column, 6));
const headerErrors = KAHUNAS_HANDOVER_HEADERS.flatMap((expected, index) => headers[index] === expected ? [] : [`Column ${index + 1} must be “${expected}”.`]);
if (headerErrors.length) throw new Error(`This does not match the AT CAPACITY handover template:\n- ${headerErrors.join("\n- ")}`);

function dateText(value) {
  if (!value) return "";
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return value;
}

const rows = [];
const rowNumbers = [...sheetXml.matchAll(/<(?:\w+:)?row\b[^>]*\br="(\d+)"/g)].map((match) => Number(match[1]));
const lastRow = Math.max(7, ...rowNumbers);
for (let rowNumber = 7; rowNumber <= lastRow; rowNumber += 1) {
  const clientName = cellText("A", rowNumber);
  if (!clientName || clientName.startsWith("EXAMPLE")) continue;
  rows.push({
    rowNumber,
    clientName,
    email: cellText("B", rowNumber),
    programme: cellText("C", rowNumber),
    startDate: dateText(cellText("D", rowNumber)),
    phone: cellText("E", rowNumber),
    mainGoal: cellText("F", rowNumber),
    context: cellText("G", rowNumber),
    driveFolderUrl: cellText("H", rowNumber),
    missingNotes: cellText("I", rowNumber),
  });
}

const validation = validateKahunasHandover(rows);
const report = {
  mode: "DRY_RUN_ONLY",
  generatedAt: new Date().toISOString(),
  sourceWorkbook: inputPath,
  expectedClientFolderContents: KAHUNAS_EXPECTED_EXPORTS,
  ...validation,
  nextStep: validation.summary.rowsWithErrors > 0
    ? "Correct the listed rows and run the preview again."
    : "Review each private Drive folder. Account creation and data import still require a separate approved operation.",
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary));
console.log(outputPath);
