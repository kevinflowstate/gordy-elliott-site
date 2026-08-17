import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("brain retrieval is separated by client and admin audience", () => {
  const migration = fs.readFileSync(
    path.join(root, "supabase/migrations/20260817113000_separate_capacity_brain_audiences.sql"),
    "utf8",
  );
  assert.match(migration, /audience IN \('client', 'admin', 'both'\)/);
  assert.match(migration, /docs\.audience IN \(query_audience, 'both'\)/);
  assert.match(migration, /query_audience IN \('client', 'admin'\)/);
  assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /staged\.audience/);

  const retrieval = fs.readFileSync(path.join(root, "lib/brain-retrieval.ts"), "utf8");
  assert.match(retrieval, /rpc\("match_brain_chunks_v2"/);
  assert.match(retrieval, /query_audience: options\.audience \|\| "client"/);

  const clientRoute = fs.readFileSync(path.join(root, "app/api/portal/ai/route.ts"), "utf8");
  const adminRoute = fs.readFileSync(path.join(root, "app/api/admin/ai/route.ts"), "utf8");
  assert.match(clientRoute, /getShiftBrainContextResult\(admin, message, \{ audience: "client" \}\)/);
  assert.match(adminRoute, /getShiftBrainContextResult\(admin, message, \{ audience: "admin" \}\)/);
});

test("curated operating-system source excludes raw private and legacy material", () => {
  const source = fs.readFileSync(
    path.join(root, "data/brain/capacity-operating-system-2026-08-approved.jsonl"),
    "utf8",
  );
  const rows = source.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(rows.length, 7);
  assert.ok(rows.every((row) => ["client", "admin", "both"].includes(String(row.audience))));
  assert.ok(rows.every((row) => row.pii_risk === "none"));
  assert.ok(rows.some((row) => row.audience === "admin"));
  assert.ok(rows.some((row) => row.audience === "client"));
  assert.doesNotMatch(source, /Kahunas|Skool|Read\.ai|Claude|revenue|pricing|baby|family member/i);
});

test("brain preparation and ingestion preserve the reviewed audience", () => {
  const prepare = fs.readFileSync(path.join(root, "scripts/prepare-shift-brain.mjs"), "utf8");
  const ingest = fs.readFileSync(path.join(root, "scripts/ingest-shift-brain.mjs"), "utf8");
  assert.match(prepare, /audience: value\.audience/);
  assert.match(prepare, /excluded_audience_for_client_scope/);
  assert.match(ingest, /audience: doc\.audience/);
});
