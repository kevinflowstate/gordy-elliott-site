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
const outputDir = path.join(process.cwd(), "output/playwright/workout-runner-navigation");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baselineOnly = process.env.WORKOUT_QA_BASELINE === "true";

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase QA credentials are not configured.");
}

const today = new Date().toISOString().slice(0, 10);
const exerciseNames = [
  "Back Squat",
  "Romanian Deadlift",
  "Incline Dumbbell Press",
  "Seated Cable Row",
  "Side Plank",
];
const fixture = {
  plan: {
    id: "qa-plan",
    client_id: "qa-client",
    name: "Founder Strength",
    description: "Deterministic workout-runner QA fixture",
    status: "active",
    start_date: today,
    created_at: `${today}T08:00:00.000Z`,
    updated_at: `${today}T08:00:00.000Z`,
    sessions: [
      {
        id: "qa-session",
        plan_id: "qa-plan",
        name: "Full Body Strength",
        day_number: 1,
        notes: "Move with intent. Leave one clean rep in reserve.",
        items: [
          {
            id: "qa-section-strength",
            session_id: "qa-session",
            exercise_id: "__section__",
            section_label: "Main strength",
            order_index: 0,
            sets: 0,
            reps: "",
          },
          ...exerciseNames.slice(0, 4).map((name, index) => ({
            id: `qa-item-${index + 1}`,
            session_id: "qa-session",
            exercise_id: `qa-exercise-${index + 1}`,
            exercise: {
              id: `qa-exercise-${index + 1}`,
              name,
              muscle_group: index < 2 ? "Lower body" : "Upper body",
              equipment: index === 0 ? "Barbell" : "Gym",
              description: `${name} coaching demonstration`,
              is_active: true,
              created_at: `${today}T08:00:00.000Z`,
            },
            order_index: index + 1,
            sets: 3,
            reps: index === 0 ? "6" : "8",
            rest_seconds: index < 2 ? 90 : 60,
            notes: index === 0 ? "Control the descent and drive through mid-foot." : undefined,
          })),
          {
            id: "qa-section-core",
            session_id: "qa-session",
            exercise_id: "__section__",
            section_label: "Core finisher",
            order_index: 4.5,
            sets: 0,
            reps: "",
          },
          {
            id: "qa-item-5",
            session_id: "qa-session",
            exercise_id: "qa-exercise-5",
            exercise: {
              id: "qa-exercise-5",
              name: exerciseNames[4],
              muscle_group: "Core",
              equipment: "Bodyweight",
              description: "Side Plank coaching demonstration",
              is_active: true,
              created_at: `${today}T08:00:00.000Z`,
            },
            order_index: 5,
            sets: 3,
            reps: "30 sec",
            prescription_type: "time",
            prescription_text: "30 sec each side",
            rest_seconds: 30,
          },
        ],
      },
    ],
  },
};

async function waitForServer(server, getServerOutput) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`The local QA server exited early: ${getServerOutput()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/manifest.json`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The local QA server did not start: ${getServerOutput()}`);
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
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewEmail,
  });
  if (linkError || (!link.properties?.hashed_token && !link.properties?.email_otp)) {
    throw new Error(linkError?.message || "Could not create the local QA sign-in.");
  }
  const authCookies = [];
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => authCookies.push(...cookies),
    },
  });
  const verifyOptions = link.properties.email_otp
    ? { email: reviewEmail, token: link.properties.email_otp, type: "email" }
    : { token_hash: link.properties.hashed_token, type: "magiclink" };
  const { error: verifyError } = await authClient.auth.verifyOtp(verifyOptions);
  if (verifyError) throw new Error(`Could not authenticate the QA fixture: ${verifyError.message}`);

  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  for (const viewport of [
    { name: "iphone", width: 390, height: 844 },
    { name: "iphone-large", width: 430, height: 932 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
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

    const page = await context.newPage();
    const consoleErrors = [];
    const serverErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });
    await page.addInitScript(() => {
      localStorage.setItem("install-banner-dismissed", "true");
      localStorage.setItem("push-banner-dismissed", "true");
    });
    await page.route("**/api/portal/exercise-plan", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
    });
    await page.route("**/api/portal/exercise-log?*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs: [] }) });
    });
    await page.route("**/api/portal/training-planner?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ assignments: [], plan_id: "qa-plan", week_start: today }),
      });
    });

    await page.goto(`${baseUrl}/portal/exercise-plan`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.getByRole("button", { name: /Start (session|next session)/ }).first().click();
    const runner = page.getByRole("dialog", { name: "Full Body Strength workout" });
    await runner.waitFor();
    await runner.getByRole("button", { name: "Start workout" }).click();
    await runner.getByRole("button", { name: "Start section" }).click();
    await runner.getByRole("heading", { name: "Back Squat" }).waitFor();

    const weightInput = runner.getByLabel("Set 1 weight in kg");
    const repsInput = runner.getByLabel("Set 1 reps");
    await weightInput.fill("82.5");
    await repsInput.fill("6");
    await repsInput.blur();
    await runner.locator("main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.waitForTimeout(100);
    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-${baselineOnly ? "baseline-active" : "active"}.png`),
      animations: "disabled",
    });

    if (!baselineOnly) {
      await runner.getByRole("button", { name: "Session overview" }).click();
      const overview = page.getByRole("dialog", { name: "Session overview" });
      await overview.waitFor();
      await page.screenshot({
        path: path.join(outputDir, `${viewport.name}-overview.png`),
        animations: "disabled",
      });

      await overview.getByRole("button", { name: /Incline Dumbbell Press/ }).click();
      await runner.getByRole("heading", { name: "Incline Dumbbell Press" }).waitFor();
      await runner.getByText("Up next").waitFor();
      await runner.getByRole("button", { name: "Session overview" }).click();
      await page.getByRole("dialog", { name: "Session overview" }).getByRole("button", { name: /Back Squat/ }).click();
      await runner.getByRole("heading", { name: "Back Squat" }).waitFor();
      if (await weightInput.inputValue() !== "82.5" || await repsInput.inputValue() !== "6") {
        throw new Error(`${viewport.name}: jumping between exercises did not preserve entered set values.`);
      }
    }

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    if (layout.documentWidth > layout.viewportWidth + 1) {
      throw new Error(`${viewport.name}: horizontal overflow ${layout.documentWidth}px > ${layout.viewportWidth}px.`);
    }
    if (consoleErrors.length) throw new Error(`${viewport.name}: console errors: ${[...new Set(consoleErrors)].join(" | ")}`);
    if (serverErrors.length) throw new Error(`${viewport.name}: server errors: ${serverErrors.join(" | ")}`);

    await context.close();
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

console.log(
  baselineOnly
    ? "Workout runner baseline captured at 390x844 and 430x932."
    : "Workout runner navigation QA passed at 390x844 and 430x932.",
);
