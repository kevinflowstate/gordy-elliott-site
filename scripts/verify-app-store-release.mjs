import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";
import appIdentity from "../config/app-identity.json" with { type: "json" };
import { createAppReviewBrowserCookies } from "./lib/app-review-browser-auth.mjs";

nextEnv.loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://localhost:4190";
const storageState = process.env.PORTAL_QA_STORAGE_STATE;
const readOnly = process.env.PORTAL_QA_READ_ONLY === "true";
const chromePath = process.env.PORTAL_QA_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await Promise.all([
  access(chromePath),
  storageState ? access(storageState) : Promise.resolve(),
]);

const failures = [];
const passes = [];

function check(condition, label, detail = "") {
  if (condition) {
    passes.push(label);
    console.log(`PASS ${label}`);
    return;
  }
  const message = detail ? `${label}: ${detail}` : label;
  failures.push(message);
  console.error(`FAIL ${message}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function open(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  check(Boolean(response && response.status() < 500), `${route} returns without a server error`, `status ${response?.status()}`);
  check(!new URL(page.url()).pathname.startsWith("/login"), `${route} preserves the authenticated session`);
}

async function assertNoHorizontalOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  check(sizes.document <= sizes.viewport + 1, `${label} has no horizontal page overflow`, JSON.stringify(sizes));
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const publicPage = await publicContext.newPage();
  for (const route of ["/privacy", "/support"]) {
    const response = await publicPage.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await settle(publicPage);
    check(response?.status() === 200, `${route} is publicly available`, `status ${response?.status()}`);
    check(!new URL(publicPage.url()).pathname.startsWith("/login"), `${route} does not require sign-in`);
    check(response?.headers()["x-content-type-options"] === "nosniff", `${route} prevents MIME sniffing`);
    check(response?.headers()["x-frame-options"] === "DENY", `${route} cannot be embedded by another site`);
    if (route === "/privacy") {
      check(
        await publicPage.getByRole("heading", { name: "Google Calendar data AT CAPACITY accesses" }).count() === 1,
        "privacy policy identifies the Google data accessed",
      );
      check(
        await publicPage.getByRole("heading", { name: "How Google Calendar data is used" }).count() === 1,
        "privacy policy explains Google data use",
      );
      check(
        await publicPage.getByRole("heading", { name: "Who receives Google Calendar data" }).count() === 1,
        "privacy policy names Google data recipients",
      );
      check(
        await publicPage.getByText(/Google Calendar data is not disclosed to Anthropic, OpenRouter/i).count() === 1,
        "privacy policy discloses Google-to-AI data isolation",
      );
      check(
        await publicPage.getByText(/will adhere to the Google User Data Policy, including the Limited Use requirements/i).count() === 1,
        "privacy policy includes the affirmative Google Limited Use statement",
      );
    }
    await assertNoHorizontalOverflow(publicPage, route);
  }
  check(
    await publicPage.getByRole("link", { name: /kevin@flowstatesystems\.ai/i }).count() > 0,
    "support page exposes a working technical contact",
  );
  for (const method of ["GET", "POST", "DELETE"]) {
    const response = await publicContext.request.fetch(`${baseUrl}/api/push/native`, {
      method,
      data: method === "GET" ? undefined : { token: "a".repeat(64), environment: "production" },
    });
    check(response.status() === 401, `native push ${method} rejects unauthenticated requests`, `status ${response.status()}`);
  }
  await publicContext.close();

  const context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  if (!storageState) {
    await context.addCookies(await createAppReviewBrowserCookies({ baseUrl }));
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const requestedHosts = new Set();
  page.on("request", (request) => requestedHosts.add(new URL(request.url()).hostname));

  await open(page, "/portal/exercise-plan");
  const chooseWorkout = page.getByRole("button", { name: "Choose workout", exact: true });
  await chooseWorkout.waitFor({ state: "visible" });
  check(await page.getByText("Browse and schedule sessions", { exact: true }).count() === 1, "training plan is visible near the top");
  check(await page.getByRole("button", { name: /start next session|start session|resume session|edit logged session/i }).count() > 0, "training primary action is available near the top");
  check(await page.getByText(/2 sessions/i).count() > 0, "training plan exposes the full session count");
  check(await chooseWorkout.count() === 1, "training exposes one unambiguous workout chooser");
  await chooseWorkout.click();
  const picker = page.getByRole("dialog", { name: "Choose a workout" });
  check(await picker.count() === 1, "workout chooser opens above the app shell");
  const pickerLayout = await picker.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const bottomChoice = element.querySelector("button:last-of-type");
    const choiceRect = bottomChoice?.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      lastChoiceBottom: choiceRect?.bottom ?? null,
      lastChoiceHit: choiceRect
        ? document.elementFromPoint(choiceRect.left + choiceRect.width / 2, choiceRect.top + choiceRect.height / 2)?.closest("button") === bottomChoice
        : false,
    };
  });
  check(
    pickerLayout.top >= 0
      && pickerLayout.bottom <= pickerLayout.viewportHeight + 1
      && pickerLayout.lastChoiceBottom !== null
      && pickerLayout.lastChoiceBottom <= pickerLayout.viewportHeight + 1
      && pickerLayout.lastChoiceHit,
    "workout choices stay visible and tappable above mobile navigation",
    JSON.stringify(pickerLayout),
  );
  await page.getByRole("button", { name: "Close session picker" }).click();

  const today = new Date();
  const earliestLogDate = new Date(today);
  earliestLogDate.setDate(today.getDate() - 56);
  const dateKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const logsPayload = await page.evaluate(async ({ from, to }) => {
    const response = await fetch(`/api/portal/exercise-log?from=${from}&to=${to}`);
    return response.ok ? response.json() : { logs: [] };
  }, { from: dateKey(earliestLogDate), to: dateKey(today) });
  const mostRecentLoggedDate = [...new Set(
    (Array.isArray(logsPayload.logs) ? logsPayload.logs : [])
      .map((log) => log?.log_date)
      .filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)),
  )].sort().at(-1);

  if (mostRecentLoggedDate) {
    const startOfWeek = (date) => {
      const copy = new Date(date);
      const weekday = copy.getDay();
      copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1));
      copy.setHours(12, 0, 0, 0);
      return copy;
    };
    const currentWeek = startOfWeek(today);
    const loggedWeek = startOfWeek(new Date(`${mostRecentLoggedDate}T12:00:00`));
    const weekOffset = Math.round((loggedWeek.getTime() - currentWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekNavigation = weekOffset < 0 ? "Previous week" : "Next week";
    for (let index = 0; index < Math.abs(weekOffset); index += 1) {
      await page.getByRole("button", { name: weekNavigation, exact: true }).click();
    }
    await page.locator(`[data-training-date="${mostRecentLoggedDate}"]`).click();
  }

  const editLoggedSession = page.getByRole("button", { name: "Edit logged session", exact: true });
  if (mostRecentLoggedDate) {
    await editLoggedSession.waitFor({ state: "visible" }).catch(() => {});
  }
  if (mostRecentLoggedDate && await editLoggedSession.count() === 1) {
    await editLoggedSession.click();
    check(await page.getByText("Editing saved session", { exact: true }).count() === 1, "saved workout opens in explicit edit mode");
    check(await page.getByRole("button", { name: "Next exercise", exact: true }).count() === 1, "saved workout edit starts with usable exercise controls");
    const workoutFooterHit = await page.evaluate(() => document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 40)?.textContent?.trim() || "");
    check(/next exercise|review workout/i.test(workoutFooterHit), "workout footer receives taps above mobile navigation", workoutFooterHit);
    await page.getByRole("button", { name: "Close workout" }).click();
  } else {
    check(
      false,
      "saved workout opens in explicit edit mode",
      mostRecentLoggedDate
        ? `the logged session for ${mostRecentLoggedDate} did not become editable`
        : "the fixture has no logged session in the last 56 days",
    );
  }
  await assertNoHorizontalOverflow(page, "training plan");

  await open(page, "/portal/calendar");
  await page.getByRole("heading", { name: "Plan around real life" }).waitFor({ state: "visible" });
  check(
    await page.getByText(/Connect your calendar to sync AT CAPACITY with your week/i).count() === 1,
    "calendar connection explains its coaching benefit concisely",
  );
  check(
    await page.getByRole("heading", { name: "Read-only schedule access, with AI kept separate" }).count() === 0,
    "calendar page does not show a permanent disclosure wall",
  );
  await assertNoHorizontalOverflow(page, "calendar connections");

  await open(page, "/portal/inbox");
  const dmComposer = page.locator('textarea[placeholder="Message Gordy..."]');
  await dmComposer.waitFor();
  check(await page.getByText("Gordy", { exact: true }).count() > 0, "client DMs identify coach messages as Gordy");
  const initialDmHeight = await dmComposer.evaluate((element) => element.getBoundingClientRect().height);
  check(initialDmHeight >= 44 && initialDmHeight <= 56, "DM composer starts as a compact single-line control", `${initialDmHeight}px`);
  check(await page.getByRole("button", { name: "Send message" }).count() === 1, "DM send arrow has one accessible action");
  await page.evaluate(() => document.documentElement.classList.add("native-app"));
  await dmComposer.focus();
  await page.waitForTimeout(150);
  check(await page.locator("html.portal-keyboard-open").count() === 1, "DM focus enters native keyboard mode");
  const navState = await page.locator(".portal-mobile-nav").evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }));
  check(navState.opacity === "0" && navState.pointerEvents === "none", "bottom navigation hides while the DM keyboard is open", JSON.stringify(navState));
  await dmComposer.fill("First line\nSecond line\nThird line");
  await dmComposer.dispatchEvent("input");
  const expandedDmHeight = await dmComposer.evaluate((element) => element.getBoundingClientRect().height);
  check(expandedDmHeight > initialDmHeight && expandedDmHeight <= 120, "DM composer expands with content and remains bounded", `${expandedDmHeight}px`);
  await dmComposer.fill("");
  await page.evaluate(() => document.documentElement.classList.remove("native-app"));

  await open(page, "/portal/daily-tracker");
  check(await page.locator('input[type="range"]').count() === 3, "Daily Tracker uses one-line sliders for all 1-10 ratings");
  const selectedDate = await page.locator('input[type="date"]').inputValue();
  const alternateRecentButton = page
    .locator("section")
    .filter({ hasText: "Recent days" })
    .locator("button:not([aria-current])")
    .first();
  if (await alternateRecentButton.count()) {
    await alternateRecentButton.click();
    await page.waitForTimeout(100);
    const changedDate = await page.locator('input[type="date"]').inputValue();
    check(changedDate !== selectedDate, "Daily Tracker recent days open the selected historical entry", `${selectedDate} -> ${changedDate}`);
  } else {
    check(false, "Daily Tracker recent days open the selected historical entry", "no alternate fixture entry found");
  }
  await assertNoHorizontalOverflow(page, "Daily Tracker");

  await open(page, "/portal/nutrition-plan");
  const nutritionFallback = page.getByRole("button", {
    name: /add daily totals manually|correct totals manually/i,
  }).first();
  await nutritionFallback.waitFor({ state: "visible" });
  const assignedNutritionPlan = page.locator("details[open]").filter({ hasText: "Your assigned meals from Gordy" }).first();
  check(await assignedNutritionPlan.count() === 1, "assigned nutrition plan is expanded and ready to use");
  check(await nutritionFallback.count() === 1, "nutrition keeps manual totals as a clearly labelled fallback");
  const nutritionText = await page.locator("body").innerText();
  check(!/copy (your|today's|this date's) myfitnesspal totals|mfp totals remain the main/i.test(nutritionText), "nutrition contains no stale manual MyFitnessPal instructions");
  await assertNoHorizontalOverflow(page, "nutrition plan");

  await open(page, "/portal/consultation");
  const dob = page.locator('input[autocomplete="bday"]');
  check(await dob.getAttribute("type") === "text", "consultation date of birth uses manual text entry");
  check(await dob.getAttribute("placeholder") === "DD/MM/YYYY", "consultation shows the DD/MM/YYYY format");
  const primaryGoalCard = page.locator("div").filter({ has: page.getByText(/primary goal/i) }).filter({ has: page.locator("textarea") }).first();
  check(await primaryGoalCard.count() > 0, "consultation primary goal is a free-text response");
  await assertNoHorizontalOverflow(page, "consultation");

  await open(page, "/portal/ai");
  const aiComposer = page.locator('[data-shift-ai-input="composer"]');
  check(await aiComposer.getAttribute("aria-label") === "Ask AT CAPACITY AI", "AT CAPACITY AI composer has a spoken label");
  check(await page.getByRole("button", { name: "Send message to AT CAPACITY AI" }).count() === 1, "AT CAPACITY AI send arrow has a spoken label");
  await page.evaluate(() => document.documentElement.classList.add("native-app"));
  await aiComposer.focus();
  await page.waitForTimeout(150);
  check(await page.locator("html.portal-keyboard-open").count() === 1, "SHIFT AI focus enters native keyboard mode");
  const aiNavOpacity = await page.locator(".portal-mobile-nav").evaluate((element) => getComputedStyle(element).opacity);
  check(aiNavOpacity === "0", "bottom navigation hides while the SHIFT AI keyboard is open", `opacity ${aiNavOpacity}`);
  await page.evaluate(() => document.documentElement.classList.remove("native-app"));
  await assertNoHorizontalOverflow(page, "SHIFT AI");

  await open(page, "/portal/settings");
  await page.getByLabel("Full Name", { exact: true }).waitFor({ state: "visible" });
  for (const label of ["Full Name", "Date of Birth", "Sex", "New Password", "Confirm Password"]) {
    check(await page.getByLabel(label, { exact: true }).count() === 1, `Settings exposes ${label} to assistive technology`);
  }
  const beforeRegistration = await context.request.get(`${baseUrl}/api/push/native`);
  const beforeRegistrationBody = await beforeRegistration.json().catch(() => ({}));
  check(beforeRegistration.status() === 200, "native push registration status is available to the signed-in client", `status ${beforeRegistration.status()}`);
  if (readOnly) {
    console.log("SKIP native push write contract (PORTAL_QA_READ_ONLY=true)");
  } else {
    const invalidEnvironment = await context.request.post(`${baseUrl}/api/push/native`, {
      data: { token: "a".repeat(64), environment: "development" },
    });
    check(invalidEnvironment.status() === 400, "native push rejects an unknown build environment", `status ${invalidEnvironment.status()}`);

    const fixtureToken = "f".repeat(64);
    try {
      const registration = await context.request.post(`${baseUrl}/api/push/native`, {
        data: { token: fixtureToken, environment: "sandbox" },
      });
      check(registration.status() === 200, "native push accepts a valid build-scoped device token", `status ${registration.status()}`);
      const afterRegistration = await context.request.get(`${baseUrl}/api/push/native`);
      const afterRegistrationBody = await afterRegistration.json().catch(() => ({}));
      check(
        afterRegistration.status() === 200 && afterRegistrationBody.deviceCount === (beforeRegistrationBody.deviceCount || 0) + 1,
        "native push registration is stored for the current account",
        JSON.stringify(afterRegistrationBody),
      );
    } finally {
      const removal = await context.request.delete(`${baseUrl}/api/push/native`, {
        data: { token: fixtureToken },
      });
      check(removal.status() === 200, "native push removes only the current device token", `status ${removal.status()}`);
    }
  }

  const forbiddenHosts = [...requestedHosts].filter((host) =>
    host === "facebook.com" || host.endsWith(".facebook.com") || host === "connect.facebook.net" || host.endsWith(".facebook.net"),
  );
  check(forbiddenHosts.length === 0, "authenticated client routes make no Meta/Facebook requests", forbiddenHosts.join(", "));
  await context.close();

  const offlineHtml = await readFile(path.resolve("native-shell/offline.html"), "utf8");
  const runtimeConfig = await readFile(path.resolve("native-shell/runtime-config.js"), "utf8");
  const serviceWorker = await readFile(path.resolve("public/sw.js"), "utf8");
  check(offlineHtml.includes("You're offline") && offlineHtml.includes("Try again"), "native shell includes a clear offline recovery screen");
  check(runtimeConfig.includes(appIdentity.productionUrl), "native shell retry targets the production portal");
  check(serviceWorker.includes('data.title || "AT CAPACITY"'), "web push fallback uses AT CAPACITY branding");
} finally {
  await browser.close();
}

console.log(`\n${passes.length} App Store release assertion(s) passed.`);
if (failures.length) {
  console.error(`${failures.length} App Store release assertion(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("App Store release browser contract passed.");
}
