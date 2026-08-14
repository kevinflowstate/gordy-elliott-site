import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4186";
const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const outputDir = path.join(process.cwd(), "output/playwright/gordy-feedback");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase QA credentials are not configured.");
}

const routes = [
  { name: "home", path: "/portal" },
  { name: "calendar", path: "/portal/calendar" },
  { name: "tracker", path: "/portal/daily-tracker" },
  { name: "checkin", path: "/portal/checkin" },
  { name: "gallery", path: "/portal/gallery" },
  { name: "training-plan", path: "/portal/exercise-plan" },
];

async function waitForServer(server, getOutput) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`QA server exited early: ${getOutput()}`);
    try {
      const response = await fetch(`${baseUrl}/manifest.json`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`QA server did not start: ${getOutput()}`);
}

async function authenticate(context, admin) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: reviewEmail });
  if (linkError || !link.properties?.hashed_token) throw new Error(linkError?.message || "Could not create QA sign-in.");

  const cookies = [];
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => [], setAll: (values) => cookies.push(...values) },
  });
  const { error } = await authClient.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) throw new Error(`Could not authenticate QA client: ${error.message}`);

  await context.addCookies(cookies.map(({ name, value, options }) => ({
    name,
    value,
    url: baseUrl,
    httpOnly: options?.httpOnly,
    secure: false,
    sameSite: options?.sameSite === "strict" ? "Strict" : options?.sameSite === "none" ? "None" : "Lax",
  })));
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const top = document.querySelector("main h1, main h2, main [role='heading']")?.getBoundingClientRect().top ?? null;
    return { viewportWidth, documentWidth, top };
  });
}

const childEnv = { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: baseUrl };
delete childEnv.NODE_OPTIONS;
delete childEnv.VERCEL;
delete childEnv.VERCEL_ENV;

const server = spawn(process.execPath, [
  path.join(process.cwd(), "node_modules/next/dist/bin/next"),
  "start", "--hostname", "127.0.0.1", "--port", new URL(baseUrl).port || "4186",
], { cwd: process.cwd(), env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
const capture = (chunk) => { serverOutput = `${serverOutput}${String(chunk)}`.slice(-4000); };
server.stdout.on("data", capture);
server.stderr.on("data", capture);

let browser;
try {
  await waitForServer(server, () => serverOutput.trim());
  await mkdir(outputDir, { recursive: true });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  for (const viewport of [
    { name: "iphone", width: 390, height: 844 },
    { name: "iphone-large", width: 430, height: 932 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    await authenticate(context, admin);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const qaDate = new Date();
    const qaDateKey = [qaDate.getFullYear(), String(qaDate.getMonth() + 1).padStart(2, "0"), String(qaDate.getDate()).padStart(2, "0")].join("-");
    const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const nextCheckinDay = weekdayNames[(qaDate.getDay() + 1) % 7];
    const calendarEvents = Array.from({ length: 3 }, (_, index) => ({
      id: `qa-event-${index}`,
      title: `QA calendar event ${index + 1}`,
      event_date: qaDateKey,
      event_time: `${10 + index}:00`,
      recurrence: "none",
      is_active: true,
      created_at: new Date().toISOString(),
      source: "connected",
    }));
    await page.route("**/api/calendar", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: calendarEvents }),
    }));
    await page.route("**/api/portal/dashboard", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: { tier: "coached", experience_mode: "default", start_date: "2026-07-01" },
        userName: "QA Client",
        checkins: [],
        planPhases: [],
        checkinDay: nextCheckinDay,
        recentModules: [],
      }),
    }));
    await page.route("**/api/portal/tasks", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tasks: [] }),
    }));
    await page.route("**/api/portal/calendar-integrations", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        providers: [
          { provider: "google_calendar", label: "Google Calendar", configured: true },
          { provider: "outlook_calendar", label: "Outlook Calendar", configured: true },
        ],
        connections: [{
          id: "qa-calendar-connection",
          provider: "google_calendar",
          status: "connected",
          last_sync_at: new Date().toISOString(),
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          consent_version: "calendar_connection_v1",
          consented_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          event_count: calendarEvents.length,
        }],
      }),
    }));
    await page.route("**/api/portal/integrations", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        latestSummary: {
          summary_date: qaDateKey,
          providers: ["oura"],
          sleep_minutes: 330,
          sleep_score: 58,
          hrv_ms: 31,
          resting_hr_bpm: 69,
          steps: 2400,
          active_calories: null,
          total_calories_burned: null,
          training_load: null,
          workout_count: null,
          nutrition_calories: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          water_ml: null,
          readiness_score: 54,
          recovery_status: "reduce_intensity",
          flags: ["poor_sleep", "low_hrv"],
          insight: "Recovery is under pressure today.",
        },
        mockMode: false,
      }),
    }));
    const photo = (colour) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${colour}"/></svg>`)}`;
    await page.route("**/api/portal/gallery", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ groups: [
        { date: "2026-08-10", front: photo("#472342"), back: photo("#26334d"), side: photo("#324838"), signedUrls: {} },
        { date: "2026-07-10", front: photo("#6d3566"), back: photo("#3e5074"), side: photo("#496c54"), signedUrls: {} },
      ] }),
    }));

    for (const route of routes) {
      const consoleErrors = [];
      const serverErrors = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("response", (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`); });

      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(400);
      if (!response || response.status() >= 500 || new URL(page.url()).pathname.startsWith("/login")) {
        throw new Error(`${viewport.name} ${route.path}: route did not load for the QA client.`);
      }

      if (route.name === "calendar") {
        const calendarDetails = page.locator("section[aria-labelledby='connected-calendars-heading'] details");
        if (await calendarDetails.count() && !(await calendarDetails.evaluate((element) => element.open))) {
          await calendarDetails.locator("summary").click();
        }
        await page.getByRole("button", { name: "Up to date" }).waitFor();
      }
      if (route.name === "home") {
        await page.getByText("Give today some breathing room", { exact: true }).waitFor();
      }
      if (route.name === "gallery") {
        const compare = page.getByRole("button", { name: "Compare photos" });
        if (await compare.count()) {
          await compare.click();
          const selects = page.getByRole("button", { name: "Select", exact: true });
          if (await selects.count() >= 2) {
            await selects.nth(0).click();
            await selects.nth(0).click();
            await page.getByRole("button", { name: "Back to gallery" }).waitFor();
          }
        }
      }
      if (route.name === "training-plan") {
        const adjust = page.getByText("Adjust this week", { exact: true });
        if (await adjust.count()) await adjust.click();
      }

      const layout = await inspectLayout(page);
      if (layout.documentWidth > layout.viewportWidth + 1) {
        throw new Error(`${viewport.name} ${route.path}: horizontal overflow ${layout.documentWidth}px > ${layout.viewportWidth}px.`);
      }
      if (serverErrors.length) throw new Error(`${viewport.name} ${route.path}: ${serverErrors.join(", ")}`);
      const meaningfulConsoleErrors = consoleErrors.filter((message) => !/favicon|403 \(Forbidden\)/i.test(message));
      if (meaningfulConsoleErrors.length) throw new Error(`${viewport.name} ${route.path}: ${[...new Set(meaningfulConsoleErrors)].join(" | ")}`);

      await page.screenshot({
        path: path.join(outputDir, `${viewport.name}-${route.name}.png`),
        fullPage: false,
        animations: "disabled",
      });
      console.log(`PASS ${viewport.name} ${route.path}`);
      page.removeAllListeners("console");
      page.removeAllListeners("response");
    }
    await context.close();
  }
  console.log("Gordy feedback visual QA passed at 390px, 430px and 1440px.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
