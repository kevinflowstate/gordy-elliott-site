import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import nextEnv from "@next/env";
import appIdentity from "../config/app-identity.json" with { type: "json" };
import { createAppReviewBrowserCookies } from "./lib/app-review-browser-auth.mjs";

nextEnv.loadEnvConfig(process.env.PORTAL_QA_ENV_DIR || process.cwd());

const baseUrl = process.env.PORTAL_QA_BASE_URL || appIdentity.productionUrl;
const storageState = process.env.PORTAL_QA_STORAGE_STATE;
const chromePath = process.env.PORTAL_QA_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = process.env.APP_STORE_SCREENSHOT_OUTPUT ||
  "/Volumes/XCode/Storage-Quarantine-2026-07-15/AT-CAPACITY-AppStore-Screenshots/draft";

await Promise.all([
  access(chromePath),
  storageState ? access(storageState) : Promise.resolve(),
]);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({
  ...(storageState ? { storageState } : {}),
  viewport: { width: 428, height: 926 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "en-GB",
  timezoneId: "Europe/London",
  colorScheme: "dark",
  serviceWorkers: "block",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AT-CAPACITY-Native/1.0 SHIFT-APNS/production",
});
if (!storageState) {
  await context.addCookies(await createAppReviewBrowserCookies({ baseUrl }));
}

const page = await context.newPage();
page.setDefaultTimeout(20_000);
await page.addInitScript(() => {
  localStorage.setItem("install-banner-dismissed", "true");
  localStorage.setItem("push-banner-dismissed", "true");
});

const captures = [
  { order: 1, name: "dashboard", route: "/portal" },
  { order: 2, name: "training-plan", route: "/portal/exercise-plan" },
  { order: 4, name: "daily-tracker", route: "/portal/daily-tracker" },
  { order: 5, name: "dm", route: "/portal/inbox" },
  { order: 6, name: "nutrition", route: "/portal/nutrition-plan" },
];

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after { caret-color: transparent !important; }
      html { scrollbar-width: none !important; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }
    `,
  });
  await page.waitForTimeout(350);
}

async function open(route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await settle();
  if (!response || response.status() >= 500) {
    throw new Error(`${route} returned ${response?.status() || "no response"}`);
  }
  if (new URL(page.url()).pathname.startsWith("/login")) {
    throw new Error(`${route} redirected to login. Refresh the Demo Client storage state.`);
  }
}

async function capture(order, name) {
  const fileName = `${String(order).padStart(2, "0")}-${name}.jpg`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({
    path: filePath,
    type: "jpeg",
    quality: 96,
    fullPage: false,
    animations: "disabled",
  });
  console.log(`Captured ${filePath}`);
  return { order, name, route: new URL(page.url()).pathname, file: fileName };
}

const manifest = [];

try {
  await open("/portal");
  await page.getByText(/good (morning|afternoon|evening), demo/i).waitFor({ state: "visible" });
  const dashboardText = await page.locator("body").innerText();
  if (!/good (morning|afternoon|evening), demo/i.test(dashboardText)) {
    throw new Error("The authenticated dashboard is not visibly identified as the Demo fixture. Capture aborted.");
  }

  for (const item of captures) {
    await open(item.route);
    if (item.name === "daily-tracker") {
      const feelingsHeading = page.getByRole("heading", { name: "How you're feeling" });
      if (await feelingsHeading.count() !== 1) {
        throw new Error("The Demo Client Daily Tracker ratings are not visible for capture.");
      }
      await feelingsHeading.evaluate((element) => {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 24);
      });
      await page.waitForTimeout(250);
    }
    manifest.push(await capture(item.order, item.name));
  }

  await open("/portal/exercise-plan");
  let sessionAction = page.getByRole("button", {
    name: /start next session|start session|resume session/i,
  }).first();
  for (let offset = 1; await sessionAction.count() === 0 && offset <= 6; offset += 1) {
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + offset);
    const day = candidate.toLocaleDateString("en-GB", { weekday: "short" });
    const date = candidate.getDate();
    const calendarDay = page.getByRole("button", { name: new RegExp(`^${day}\\s*${date}$`, "i") }).first();
    if (await calendarDay.count() === 1) {
      await calendarDay.click();
      await page.waitForTimeout(200);
      sessionAction = page.getByRole("button", {
        name: /start next session|start session|resume session/i,
      }).first();
    }
  }
  if (await sessionAction.count() !== 1) {
    throw new Error("No active-session action is available in the Demo Client training plan.");
  }
  await sessionAction.click();
  const workoutDialog = page.getByRole("dialog", { name: /workout$/i });
  await workoutDialog.waitFor({ state: "visible" });
  const beginWorkout = workoutDialog.getByRole("button", {
    name: /start workout|continue workout|edit workout/i,
  });
  if (await beginWorkout.count() === 1) {
    await beginWorkout.click();
  }
  if (await page.getByRole("button", { name: /next exercise|review workout|save session/i }).count() === 0) {
    throw new Error("The active session did not open after selecting the primary training action.");
  }
  await page.waitForTimeout(250);
  manifest.push(await capture(3, "active-session"));

  manifest.sort((a, b) => a.order - b.order);
  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      viewport: { width: 428, height: 926, deviceScaleFactor: 3 },
      outputPixels: { width: 1284, height: 2778 },
      captures: manifest,
    }, null, 2)}\n`,
    "utf8",
  );
} finally {
  await browser.close();
}

console.log(`Prepared ${manifest.length} App Store draft screenshots in ${outputDir}`);
