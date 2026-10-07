import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DailyTrackerPage from "../app/portal/daily-tracker/page";
import { ToastProvider } from "../components/ui/Toast";

test("all tracker entry controls wait for the selected date before accepting edits", () => {
  const markup = renderToStaticMarkup(React.createElement(ToastProvider, null, React.createElement(DailyTrackerPage)));
  const entry = markup.match(/<fieldset\b[^>]*disabled=""[^>]*aria-label="Daily tracker entry"[^>]*>([\s\S]*?)<\/fieldset>/)?.[1];
  assert.ok(entry, "the loading form has a disabled fieldset, which natively disables all descendant controls");
  for (const label of ["Steps", "Sleep hours", "Water litres", "Energy", "Stress", "Nutrition", "Training", "Notes", "Save daily tracker"]) assert.ok(entry.includes(label), label);
  assert.match(entry, /<textarea\b/);
  assert.match(entry, /type="range"/);
});
