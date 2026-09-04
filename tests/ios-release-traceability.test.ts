import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const archiveScriptUrl = new URL("../scripts/archive-ios.mjs", import.meta.url);
const launchRunbookUrl = new URL("../LAUNCH.md", import.meta.url);

test("iOS archives cannot be overwritten and record their source revision", async () => {
  const script = await readFile(archiveScriptUrl, "utf8");

  assert.match(script, /Refusing to overwrite the existing archive/);
  assert.match(script, /git", \["rev-parse", "HEAD"\]/);
  assert.match(script, /gitSha: sourceRevision\.stdout\.trim\(\)/);
  assert.match(script, /sourceReceiptPath/);
});

test("release rollback guidance accounts for the hosted iOS portal", async () => {
  const runbook = await readFile(launchRunbookUrl, "utf8");

  assert.match(runbook, /iOS hosted-portal release control/);
  assert.match(runbook, /Vercel deployment ID, Git SHA, iOS version\/build/);
  assert.match(runbook, /Any later portal deployment invalidates that walkthrough/);
  assert.match(runbook, /App Store binary cannot be rolled back/);
});
