import assert from "node:assert/strict";
import test from "node:test";
import { validateKahunasHandover, type KahunasHandoverInput } from "../lib/kahunas-import";

function row(overrides: Partial<KahunasHandoverInput> = {}): KahunasHandoverInput {
  return {
    rowNumber: 8,
    clientName: "Jane Smith",
    email: "jane@example.com",
    programme: "SHIFT",
    startDate: "2026-08-01",
    phone: "+44 7700 900000",
    mainGoal: "Build consistency",
    context: "",
    driveFolderUrl: "https://drive.google.com/drive/folders/example-folder",
    missingNotes: "",
    ...overrides,
  };
}

test("Kahunas preview normalises a complete row without writing data", () => {
  const result = validateKahunasHandover([row()]);
  assert.deepEqual(result.summary, { totalRows: 1, readyRows: 1, rowsWithErrors: 0, warnings: 0 });
  assert.equal(result.records[0].programme, "shift");
  assert.equal(result.records[0].email, "jane@example.com");
});

test("Kahunas preview rejects missing required values and non-folder links", () => {
  const result = validateKahunasHandover([row({ email: "bad", driveFolderUrl: "https://example.com/file" })]);
  assert.equal(result.summary.readyRows, 0);
  assert.equal(result.summary.rowsWithErrors, 1);
  assert.ok(result.issues.some((issue) => issue.field === "email" && issue.severity === "error"));
  assert.ok(result.issues.some((issue) => issue.field === "driveFolderUrl" && issue.severity === "error"));
});

test("Kahunas preview catches duplicate client emails", () => {
  const result = validateKahunasHandover([row(), row({ rowNumber: 9, clientName: "Jane Duplicate" })]);
  assert.equal(result.summary.readyRows, 1);
  assert.equal(result.summary.rowsWithErrors, 1);
  assert.match(result.issues.find((issue) => issue.rowNumber === 9)?.message || "", /row 8/i);
});

test("a missing main goal is a warning rather than a destructive guess", () => {
  const result = validateKahunasHandover([row({ mainGoal: "" })]);
  assert.equal(result.summary.readyRows, 1);
  assert.equal(result.summary.warnings, 1);
});
