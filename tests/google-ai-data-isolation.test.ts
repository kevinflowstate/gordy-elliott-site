import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const AI_ROUTE_PATHS = [
  "app/api/portal/ai/route.ts",
  "app/api/admin/ai/route.ts",
  "app/api/admin/ai-generate-nutrition/route.ts",
  "app/api/admin/client-coaching-notes/extract/route.ts",
];

test("Google Calendar tables are excluded from every AI route", async () => {
  for (const path of AI_ROUTE_PATHS) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /client_calendar_events|calendar_events/);
  }
});

test("every OpenRouter request enforces zero data retention", async () => {
  const consultation = await readFile("app/api/portal/consultation/route.ts", "utf8");
  const retrieval = await readFile("lib/brain-retrieval.ts", "utf8");
  const ingestion = await readFile("scripts/ingest-shift-brain.mjs", "utf8");

  assert.match(consultation, /provider:\s*\{\s*zdr:\s*true\s*\}/);
  assert.match(retrieval, /provider:\s*\{\s*zdr:\s*true\s*\}/);
  assert.match(ingestion, /provider:\s*\{\s*zdr:\s*true\s*\}/);
});

test("calendar-derived coaching signals remain deterministic", async () => {
  for (const path of ["lib/storm-warning.ts", "lib/weekly-capacity.ts"]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /anthropic|openrouter|openai|api\/v1\/messages|chat\/completions/i);
  }
});
