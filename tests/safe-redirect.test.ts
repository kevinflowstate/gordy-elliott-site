import assert from "node:assert/strict";
import test from "node:test";
import { safeLocalRedirect } from "../lib/safe-redirect";

test("keeps authenticated app deep links local", () => {
  assert.equal(safeLocalRedirect("/portal/inbox?from=push#latest"), "/portal/inbox?from=push#latest");
});

test("rejects external and protocol-relative redirect targets", () => {
  assert.equal(safeLocalRedirect("https://example.com"), "/portal");
  assert.equal(safeLocalRedirect("//example.com/portal"), "/portal");
  assert.equal(safeLocalRedirect("javascript:alert(1)"), "/portal");
});

test("rejects paths that normalise into protocol-relative redirects", () => {
  assert.equal(safeLocalRedirect("/..//evil.com"), "/portal");
  assert.equal(safeLocalRedirect("/\\evil.com"), "/portal");
  assert.equal(safeLocalRedirect("/portal\nevil"), "/portal");
});

test("never trusts an unsafe fallback", () => {
  assert.equal(safeLocalRedirect(null, "//evil.com"), "/portal");
  assert.equal(safeLocalRedirect(null, "/login?reason=expired"), "/login?reason=expired");
});
