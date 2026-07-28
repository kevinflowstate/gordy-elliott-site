import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  "../app/api/admin/client-early-win/route.ts",
  "../app/api/admin/client-compliance/route.ts",
  "../app/api/admin/client-month4-review/route.ts",
];

test("Founder outcome APIs enforce experience mode on the server", async () => {
  for (const route of routes) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    assert.match(source, /import \{ isFounderExperience \} from "@\/lib\/client-experience";/);
    assert.match(source, /function founderOnlyError\(experienceMode: unknown\)/);
    assert.match(source, /isFounderExperience\(experienceMode\)/);
    assert.match(source, /\{ status: 409 \}/);
  }
});

test("record-id mutations resolve the owning client before writing", async () => {
  const [earlyWin, compliance, month4] = await Promise.all(
    routes.map((route) => readFile(new URL(route, import.meta.url), "utf8")),
  );

  assert.match(earlyWin, /\.select\("id, client_id, status"\)/);
  assert.match(earlyWin, /getProfile\(admin, earlyWin\.client_id\)/);
  assert.match(compliance, /\.select\("id, client_id"\)/);
  assert.match(compliance, /getProfile\(admin, (?:record|existing)\.client_id\)/);
  assert.match(month4, /\.select\("id, client_id, status"\)/);
  assert.match(month4, /getProfile\(admin, review\.client_id\)/);
});
