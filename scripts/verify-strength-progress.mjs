import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4175";
const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const outputDir = path.join(process.cwd(), "output/playwright/strength-progress");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase QA credentials are not configured.");
}

const strengthFixture = {
  today: "2026-08-04",
  sessions: [
    {
      sessionId: "lower-a",
      sessionName: "Lower Body A",
      date: "2026-08-03",
      durationSeconds: 2520,
      totalTonnageKg: 3240,
      completedSets: 9,
      totalReps: 78,
      comparison: {
        previousDate: "2026-07-27",
        tonnageChangeKg: 180,
        durationChangeSeconds: -150,
        repsChange: 2,
      },
      exercises: [
        {
          exerciseId: "exercise-trap-bar",
          exerciseName: "Trap Bar Deadlift",
          completedSets: 3,
          totalReps: 18,
          totalTonnageKg: 1890,
          sets: [
            { setNumber: 1, displayValue: "105kg × 6", weightKg: 105, reps: 6, tonnageKg: 630 },
            { setNumber: 2, displayValue: "105kg × 6", weightKg: 105, reps: 6, tonnageKg: 630 },
            { setNumber: 3, displayValue: "105kg × 6", weightKg: 105, reps: 6, tonnageKg: 630 },
          ],
        },
        {
          exerciseId: "exercise-split-squat",
          exerciseName: "Rear Foot Elevated Split Squat",
          completedSets: 3,
          totalReps: 30,
          totalTonnageKg: 900,
          sets: [
            { setNumber: 1, displayValue: "30kg × 10", weightKg: 30, reps: 10, tonnageKg: 300 },
            { setNumber: 2, displayValue: "30kg × 10", weightKg: 30, reps: 10, tonnageKg: 300 },
            { setNumber: 3, displayValue: "30kg × 10", weightKg: 30, reps: 10, tonnageKg: 300 },
          ],
        },
      ],
    },
  ],
  consistency: {
    completedSessions: 9,
    plannedSessions: 11,
    completedPlannedSessions: 9,
    completionRate: 82,
    currentWeekCompleted: 2,
    currentWeekPlanned: 3,
    activeWeekStreak: 4,
    weeks: [
      { weekStart: "2026-07-13", planned: 3, completed: 2 },
      { weekStart: "2026-07-20", planned: 2, completed: 2 },
      { weekStart: "2026-07-27", planned: 3, completed: 3 },
      { weekStart: "2026-08-03", planned: 3, completed: 2 },
    ],
  },
  trackers: [
    {
      id: "tracker-trap-bar",
      exerciseId: "exercise-trap-bar",
      exerciseName: "Trap Bar Deadlift",
      metricType: "load_reps",
      metricLabel: "Estimated strength",
      unit: "kg e1RM",
      currentValue: 126,
      bestValue: 126,
      change: 14.3,
      latestSetLabel: "105kg × 6",
      latestDate: "2026-08-03",
      points: [
        { date: "2026-07-07", value: 111.7, setLabel: "95kg × 5", isPersonalBest: true },
        { date: "2026-07-21", value: 120, setLabel: "100kg × 6", isPersonalBest: true },
        { date: "2026-08-03", value: 126, setLabel: "105kg × 6", isPersonalBest: true },
      ],
    },
    {
      id: "tracker-pull-up",
      exerciseId: "exercise-pull-up",
      exerciseName: "Neutral Grip Pull-up",
      metricType: "reps",
      metricLabel: "Best completed set",
      unit: "reps",
      currentValue: 10,
      bestValue: 10,
      change: 2,
      latestSetLabel: "10 reps",
      latestDate: "2026-08-01",
      points: [
        { date: "2026-07-10", value: 8, setLabel: "8 reps", isPersonalBest: true },
        { date: "2026-08-01", value: 10, setLabel: "10 reps", isPersonalBest: true },
      ],
    },
  ],
};

async function waitForServer(server, getServerOutput) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`The local QA server exited early: ${getServerOutput()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/manifest.json`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The local QA server did not start: ${getServerOutput()}`);
}

async function addAuthenticatedCookies(context, admin) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewEmail,
  });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error(linkError?.message || "Could not create the local QA sign-in.");
  }

  const authCookies = [];
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => authCookies.push(...cookies),
    },
  });
  const { error: verifyError } = await authClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw new Error(`Could not authenticate the QA fixture: ${verifyError.message}`);

  await context.addCookies(authCookies.map(({ name, value, options }) => ({
    name,
    value,
    url: baseUrl,
    httpOnly: options?.httpOnly,
    secure: false,
    sameSite: options?.sameSite === "strict"
      ? "Strict"
      : options?.sameSite === "none"
        ? "None"
        : "Lax",
  })));
}

function assertNoHorizontalOverflow(page, viewportName) {
  return page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  })).then(({ viewportWidth, documentWidth }) => {
    if (documentWidth > viewportWidth + 1) {
      throw new Error(`${viewportName}: horizontal overflow ${documentWidth}px > ${viewportWidth}px`);
    }
  });
}

const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: baseUrl,
};
delete childEnv.NODE_OPTIONS;
delete childEnv.VERCEL;
delete childEnv.VERCEL_ENV;

const server = spawn(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    new URL(baseUrl).port || "4175",
  ],
  { cwd: process.cwd(), env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
const captureServerOutput = (chunk) => {
  serverOutput = `${serverOutput}${String(chunk)}`.slice(-3000);
};
server.stdout.on("data", captureServerOutput);
server.stderr.on("data", captureServerOutput);

let browser;
try {
  await waitForServer(server, () => serverOutput.trim());
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  for (const viewport of [
    { name: "iphone-se", width: 320, height: 568 },
    { name: "iphone", width: 390, height: 844 },
    { name: "iphone-large", width: 430, height: 932 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    await addAuthenticatedCookies(context, admin);
    const page = await context.newPage();
    const consoleErrors = [];
    const serverErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });
    await page.route("**/api/portal/strength-progress", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(strengthFixture),
    }));

    await page.goto(`${baseUrl}/portal/progress`, { waitUntil: "networkidle", timeout: 30_000 });
    if (new URL(page.url()).pathname !== "/portal/progress") {
      throw new Error(`${viewport.name}: QA sign-in landed on ${new URL(page.url()).pathname}.`);
    }
    await page.getByRole("heading", { name: "Strength & Performance" }).waitFor();
    await page.getByRole("heading", { name: "Trap Bar Deadlift", exact: true }).waitFor();
    await page.getByText("Lower Body A", { exact: true }).waitFor();
    await page.getByText("3,240kg", { exact: true }).waitFor();
    const consistencyDetails = page.locator("#strength-performance details").filter({ hasText: "Training consistency" });
    await consistencyDetails.locator("summary").click();
    await consistencyDetails.locator("[aria-label='Four-week training history']").waitFor();
    await page.getByText(/82%/).first().waitFor();
    await assertNoHorizontalOverflow(page, viewport.name);

    await page.locator("#strength-performance").screenshot({
      path: path.join(outputDir, `${viewport.name}-strength.png`),
      animations: "disabled",
    });

    await page.getByRole("link", { name: "Measurements & weight" }).click();
    await page.locator("#body-progress").waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector("#body-progress");
      if (!element) return false;
      const top = element.getBoundingClientRect().top;
      return top >= -1 && top < window.innerHeight;
    }, null, { timeout: 3_000 });
    const bodyPosition = await page.locator("#body-progress").evaluate((element) => element.getBoundingClientRect().top);
    if (bodyPosition > viewport.height || bodyPosition < -1) {
      throw new Error(`${viewport.name}: the body-progress anchor did not move into view`);
    }
    if (serverErrors.length) throw new Error(`${viewport.name}: server errors: ${serverErrors.join(", ")}`);
    if (consoleErrors.length) throw new Error(`${viewport.name}: console errors: ${[...new Set(consoleErrors)].join(" | ")}`);
    await context.close();
  }

  for (const state of ["empty", "error"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    await addAuthenticatedCookies(context, admin);
    const page = await context.newPage();
    await page.route("**/api/portal/strength-progress", (route) => {
      if (state === "error") {
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "QA failure" }) });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...strengthFixture, sessions: [], trackers: [] }),
      });
    });
    await page.goto(`${baseUrl}/portal/progress`, { waitUntil: "networkidle", timeout: 30_000 });
    if (state === "empty") {
      await page.getByText("Your session progress will appear here", { exact: true }).waitFor();
      await page.getByText("Key movements coming soon", { exact: true }).waitFor();
    } else {
      await page.getByText("We couldn't load training progress. Try refreshing the page.", { exact: true }).waitFor();
    }
    await assertNoHorizontalOverflow(page, `iphone-${state}`);
    await page.locator("#strength-performance").screenshot({
      path: path.join(outputDir, `iphone-${state}.png`),
      animations: "disabled",
    });
    await context.close();
  }

  console.log("Strength Progress visual QA passed at 320, 390, 430 and 1440px, including empty and error states.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
