import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4173";
const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const outputDir = path.join(process.cwd(), "output/playwright/terra-connected-apps");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useVisualFixture = process.env.PORTAL_QA_WEARABLE_FIXTURE === "true";

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase QA credentials are not configured.");
}

function dateKey(daysAgo) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildVisualFixture() {
  const history = [
    { readiness: 78, sleep: 430, sleepScore: 76, hrv: 46, heartRate: 57, steps: 6840, activeCalories: 510, load: 48, workouts: 1, calories: 2080, protein: 142, carbs: 214, fat: 71, water: 2600 },
    { readiness: 74, sleep: 405, sleepScore: 72, hrv: 43, heartRate: 59, steps: 5210, activeCalories: 390, load: 32, workouts: 0, calories: 2190, protein: 136, carbs: 238, fat: 74, water: 2400 },
    { readiness: 81, sleep: 456, sleepScore: 80, hrv: 49, heartRate: 55, steps: 8160, activeCalories: 620, load: 57, workouts: 1, calories: 2310, protein: 151, carbs: 246, fat: 78, water: 2900 },
    { readiness: 69, sleep: 382, sleepScore: 68, hrv: 40, heartRate: 61, steps: 4740, activeCalories: 340, load: 72, workouts: 1, calories: 2240, protein: 128, carbs: 252, fat: 70, water: 2200 },
    { readiness: 76, sleep: 421, sleepScore: 74, hrv: 44, heartRate: 58, steps: 7390, activeCalories: 540, load: 45, workouts: 1, calories: 2160, protein: 145, carbs: 222, fat: 72, water: 2700 },
    { readiness: 79, sleep: 443, sleepScore: 78, hrv: 47, heartRate: 56, steps: 7690, activeCalories: 580, load: 51, workouts: 1, calories: 2270, protein: 149, carbs: 241, fat: 76, water: 2800 },
    { readiness: 84, sleep: 468, sleepScore: 82, hrv: 51, heartRate: 54, steps: 8133, activeCalories: 640, load: 54, workouts: 1, calories: 2350, protein: 154, carbs: 255, fat: 79, water: 3000 },
  ];
  const summaries = history
    .map((day, index) => ({
      id: `visual-summary-${index}`,
      summary_date: dateKey(history.length - 1 - index),
      providers: ["oura", "myfitnesspal"],
      sleep_minutes: day.sleep,
      sleep_score: day.sleepScore,
      hrv_ms: day.hrv,
      resting_hr_bpm: day.heartRate,
      steps: day.steps,
      active_calories: day.activeCalories,
      total_calories_burned: day.activeCalories + 1680,
      training_load: day.load,
      workout_count: day.workouts,
      nutrition_calories: day.calories,
      protein_g: day.protein,
      carbs_g: day.carbs,
      fat_g: day.fat,
      water_ml: day.water,
      readiness_score: day.readiness,
      recovery_status: "good",
      flags: [],
      insight: index === history.length - 1
        ? "Recovery is trending well. Complete the planned session and keep the final working sets around RPE 8."
        : "Recovery signals were steady. There was no connected-app reason to change the planned session.",
    }))
    .reverse();
  const now = new Date().toISOString();
  return {
    mockMode: false,
    available: true,
    consentAccepted: true,
    connections: [
      {
        id: "visual-oura",
        client_id: "visual-client",
        provider: "oura",
        terra_user_id: "visual-oura-user",
        reference_id: "visual-client",
        status: "connected",
        last_sync_at: now,
        connected_at: now,
        disconnected_at: null,
        consent_version: "wearable_connection_v2",
        consented_at: now,
      },
      {
        id: "visual-mfp",
        client_id: "visual-client",
        provider: "myfitnesspal",
        terra_user_id: "visual-mfp-user",
        reference_id: "visual-client",
        status: "connected",
        last_sync_at: now,
        connected_at: now,
        disconnected_at: null,
        consent_version: "wearable_connection_v2",
        consented_at: now,
      },
    ],
    latestSummary: summaries[0],
    summaries,
  };
}

async function waitForServer(server, getServerOutput) {
  for (let attempt = 0; attempt < 120; attempt++) {
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
  TERRA_DEV_ID: "local-visual-qa",
  TERRA_API_KEY: "local-visual-qa",
  TERRA_WEBHOOK_SIGNING_SECRET: "local-visual-qa",
};
delete childEnv.NODE_OPTIONS;
delete childEnv.VERCEL;
delete childEnv.VERCEL_ENV;

if (process.env.PORTAL_QA_REBUILD === "true") {
  const buildExitCode = await new Promise((resolve, reject) => {
    const build = spawn(
      process.execPath,
      [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "build"],
      { cwd: process.cwd(), env: childEnv, stdio: "inherit" },
    );
    build.once("error", reject);
    build.once("exit", resolve);
  });
  if (buildExitCode !== 0) throw new Error(`The QA production build exited with code ${buildExitCode}.`);
}

const server = spawn(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    new URL(baseUrl).port || "4173",
  ],
  { cwd: process.cwd(), env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
const captureServerOutput = (chunk) => {
  serverOutput = `${serverOutput}${String(chunk)}`.slice(-2000);
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

  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
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
  await page.addInitScript(() => {
    localStorage.setItem("install-banner-dismissed", "true");
    localStorage.setItem("push-banner-dismissed", "true");
  });
  const consoleErrors = [];
  const serverErrors = [];
  if (useVisualFixture) {
    const visualFixture = buildVisualFixture();
    await page.route("**/api/portal/integrations", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(visualFixture),
      });
    });
  }
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${baseUrl}/portal/connected-apps`, { waitUntil: "networkidle", timeout: 30_000 });
  if (!new URL(page.url()).pathname.startsWith("/portal/connected-apps")) {
    throw new Error(`QA sign-in did not reach Connected Apps (landed on ${new URL(page.url()).pathname}).`);
  }

  for (const viewport of [
    { name: "iphone", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/portal/connected-apps`, { waitUntil: "networkidle" });

    await page.getByRole("heading", { name: "Health & Capacity" }).waitFor();
    await page.getByRole("button", { name: "Activity" }).click();
    await page.getByRole("heading", { name: "Movement and training" }).waitFor();
    await page.getByRole("button", { name: "Overview" }).click();
    await page.getByRole("heading", { name: "Today at a glance" }).waitFor();

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    if (layout.documentWidth > layout.viewportWidth + 1) {
      throw new Error(`${viewport.name}: horizontal overflow ${layout.documentWidth}px > ${layout.viewportWidth}px`);
    }

    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}.png`),
      fullPage: false,
      animations: "disabled",
    });
    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-full.png`),
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Manage health data connections" }).click();
    await page.getByRole("heading", { name: "Connections", exact: true }).waitFor();
    const checkbox = page.getByRole("checkbox");
    const garminButton = page.getByRole("button", { name: /^connect$/i }).first();
    if (await checkbox.count()) {
      if (!await garminButton.isDisabled()) throw new Error(`${viewport.name}: provider button enabled without consent`);
      await checkbox.check();
      if (await garminButton.isDisabled()) throw new Error(`${viewport.name}: provider button stayed disabled after consent`);
    }
    if (await page.getByText("WHOOP and Strava", { exact: true }).count() !== 1) {
      throw new Error(`${viewport.name}: WHOOP/Strava roadmap state is missing`);
    }
    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-connections.png`),
      fullPage: false,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Back to Health and Capacity" }).click();
    await page.getByRole("heading", { name: "Health & Capacity" }).waitFor();
  }

  if (serverErrors.length) throw new Error(`Server errors: ${serverErrors.join(", ")}`);
  if (consoleErrors.length) throw new Error(`Console errors: ${[...new Set(consoleErrors)].join(" | ")}`);
  console.log("Terra Connected Apps visual QA passed at 390x844 and 1440x1000.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
