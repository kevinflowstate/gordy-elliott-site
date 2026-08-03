import nextEnv from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4174";
const reviewEmail = (process.env.APP_REVIEW_EMAIL || "demo@flowstatesystems.ai").toLowerCase();
const outputDir = path.join(process.cwd(), "output/playwright/myfitnesspal-nutrition");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase QA credentials are not configured.");
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
    new URL(baseUrl).port || "4174",
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

  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  for (const viewport of [
    { name: "iphone", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 1000 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
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

    const page = await context.newPage();
    const consoleErrors = [];
    const serverErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });
    await page.route("**/api/portal/nutrition-plan?*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.syncedNutrition = {
        provider: "myfitnesspal",
        summaryDate: new Date().toISOString().slice(0, 10),
        calories: 1840,
        proteinG: 112,
        carbsG: 205,
        fatG: 61,
        waterMl: 2100,
        summaryUpdatedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        connectionStatus: "connected",
      };
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

    await page.goto(`${baseUrl}/portal/nutrition-plan`, { waitUntil: "networkidle", timeout: 30_000 });
    if (!new URL(page.url()).pathname.startsWith("/portal/nutrition-plan")) {
      throw new Error(`${viewport.name}: QA sign-in landed on ${new URL(page.url()).pathname}.`);
    }
    const syncedHeading = page.getByText("Synced from MyFitnessPal", { exact: true });
    await syncedHeading.waitFor();
    await page.getByText("1,840", { exact: true }).first().waitFor();
    await page.getByText("2.1L", { exact: true }).waitFor();

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    if (layout.documentWidth > layout.viewportWidth + 1) {
      throw new Error(`${viewport.name}: horizontal overflow ${layout.documentWidth}px > ${layout.viewportWidth}px`);
    }

    await syncedHeading.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-summary.png`),
      fullPage: false,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Correct totals manually" }).click();
    await page.getByRole("heading", { name: "Add daily totals manually" }).waitFor();
    await page.getByRole("button", { name: "Save daily totals" }).waitFor();
    const modalBox = await page.getByRole("heading", { name: "Add daily totals manually" })
      .locator("xpath=..")
      .boundingBox();
    if (!modalBox || modalBox.y < 0 || modalBox.y + modalBox.height > viewport.height + 1) {
      throw new Error(`${viewport.name}: the manual correction panel is clipped`);
    }

    await page.screenshot({
      path: path.join(outputDir, `${viewport.name}-correction.png`),
      fullPage: false,
      animations: "disabled",
    });

    if (serverErrors.length) throw new Error(`${viewport.name}: server errors: ${serverErrors.join(", ")}`);
    if (consoleErrors.length) throw new Error(`${viewport.name}: console errors: ${[...new Set(consoleErrors)].join(" | ")}`);
    await context.close();
  }

  console.log("MyFitnessPal Nutrition visual QA passed at 390x844 and 1440x1000.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
