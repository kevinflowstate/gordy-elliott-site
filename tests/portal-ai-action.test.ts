import assert from "node:assert/strict";
import test from "node:test";
import { getPortalAIAction } from "../lib/portal-ai-action";

test("Education answers link to the published Education area", () => {
  assert.deepEqual(getPortalAIAction("Where is that lesson?", "It is available in Education."), {
    label: "Open Education",
    href: "/portal/training",
  });
});

test("workout answers link to the exercise plan rather than Education", () => {
  assert.deepEqual(getPortalAIAction("What is my next session?", "Your next session is lower body."), {
    label: "Open Training",
    href: "/portal/exercise-plan",
  });
});

test("the client's nutrition question wins over training language in the reply", () => {
  assert.deepEqual(getPortalAIAction("What should I eat today?", "Good nutrition supports your training plan."), {
    label: "Open Nutrition",
    href: "/portal/nutrition-plan",
  });
});

test("the phrase of course does not route to Education", () => {
  assert.deepEqual(getPortalAIAction("What is next?", "Of course, your next session is ready."), {
    label: "Open Training",
    href: "/portal/exercise-plan",
  });
});
