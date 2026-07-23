import assert from "node:assert/strict";
import test from "node:test";
import {
  isAttentionSignalEnabled,
  resolveClientLifecycleStatus,
} from "../lib/client-attention";

test("monitoring preferences and active snoozes suppress Capacity Scan signals", () => {
  assert.equal(isAttentionSignalEnabled("wearables"), false);
  assert.equal(isAttentionSignalEnabled("wearables", { monitor_wearables: true }), true);
  assert.equal(
    isAttentionSignalEnabled(
      "wearables",
      { monitor_wearables: true },
      [{ signal: "wearables", ignored: true, snoozed_until: null }],
    ),
    false,
  );
  assert.equal(
    isAttentionSignalEnabled(
      "daily_metrics",
      { monitor_daily_metrics: true },
      [{ signal: "daily_metrics", ignored: false, snoozed_until: "2030-01-01T00:00:00.000Z" }],
      new Date("2026-07-23T00:00:00.000Z").getTime(),
    ),
    false,
  );
});

test("a scheduled lifecycle pause resolves when its resume time has passed", () => {
  const now = new Date("2026-07-23T12:00:00.000Z").getTime();
  assert.equal(resolveClientLifecycleStatus("paused", "2026-07-23T11:59:00.000Z", now), "active");
  assert.equal(resolveClientLifecycleStatus("access_frozen", "2026-07-24T12:00:00.000Z", now), "access_frozen");
});
