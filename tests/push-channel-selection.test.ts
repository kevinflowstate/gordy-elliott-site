import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseWebPushFallback } from "../lib/push-contract";

test("native delivery suppresses legacy web push duplicates", () => {
  assert.equal(shouldUseWebPushFallback({ sent: 1 }), false);
  assert.equal(shouldUseWebPushFallback({ sent: 3 }), false);
});

test("web push is the fallback when native delivery sends nothing", () => {
  assert.equal(shouldUseWebPushFallback({ sent: 0 }), true);
});
