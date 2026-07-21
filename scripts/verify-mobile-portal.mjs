import { access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4190";
const storageState = process.env.PORTAL_QA_STORAGE_STATE;
const screenshotDir = process.env.PORTAL_QA_SCREENSHOT_DIR;

const mobileRoutes = [
  "/portal",
  "/portal/training",
  "/portal/nutrition-plan",
  "/portal/daily-tracker",
  "/portal/inbox",
  "/portal/checkin",
  "/portal/progress",
  "/portal/cycle",
  "/portal/connected-apps",
  "/portal/consultation",
  "/portal/documents",
  "/portal/gallery",
  "/portal/exercise-plan",
  "/portal/plan",
  "/portal/settings",
  "/portal/ai",
  "/portal/calendar",
];

const desktopRoutes = [
  "/portal",
  "/portal/training",
  "/portal/nutrition-plan",
  "/portal/inbox",
  "/portal/settings",
];

const runs = [
  { name: "iphone-se", width: 320, height: 568, routes: mobileRoutes },
  { name: "iphone", width: 390, height: 844, routes: mobileRoutes },
  { name: "iphone-large", width: 430, height: 932, routes: mobileRoutes },
  { name: "desktop", width: 1440, height: 1000, routes: desktopRoutes },
];

function defaultChromePath() {
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.PROGRAMFILES || "C:\\Program Files",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe",
    );
  }
  return "/usr/bin/google-chrome";
}

function routeName(route) {
  return route === "/portal" ? "dashboard" : route.split("/").filter(Boolean).at(-1);
}

if (!storageState) {
  console.error("Set PORTAL_QA_STORAGE_STATE to a Playwright storage-state file for an authenticated client.");
  process.exit(2);
}

const chromePath = process.env.PORTAL_QA_CHROME_PATH || defaultChromePath();
await Promise.all([access(storageState), access(chromePath)]).catch((error) => {
  console.error(`Mobile QA setup is incomplete: ${error.message}`);
  process.exit(2);
});

if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const failures = [];

try {
  for (const run of runs) {
    const context = await browser.newContext({
      storageState,
      viewport: { width: run.width, height: run.height },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);

    for (const route of run.routes) {
      const consoleErrors = [];
      const serverErrors = [];
      let sawExpectedDocumentDenial = false;
      const onConsole = (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/webpack-hmr|favicon|403 \(Forbidden\)/i.test(text)) return;
        if (route === "/portal/documents" && /failed to load resource.*status of 403/i.test(text)) return;
        consoleErrors.push(text);
      };
      const onResponse = (response) => {
        if (
          route === "/portal/documents" &&
          response.status() === 403 &&
          new URL(response.url()).pathname === "/api/portal/documents"
        ) {
          sawExpectedDocumentDenial = true;
        }
        if (response.status() >= 500) {
          serverErrors.push(`${response.status()} ${response.url()}`);
        }
      };

      page.on("console", onConsole);
      page.on("response", onResponse);

      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
      await page.waitForTimeout(500);

      const layout = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        );

        const isIntentionalScroller = (element) => {
          let current = element;
          while (current && current !== document.body) {
            if (current.hasAttribute("data-allow-horizontal-overflow")) return true;
            const overflowX = getComputedStyle(current).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") return true;
            current = current.parentElement;
          }
          return false;
        };

        const outside = [...document.querySelectorAll("body *")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || isIntentionalScroller(element)) return false;
            return rect.left < -2 || rect.right > viewportWidth + 2;
          })
          .slice(0, 12)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
            };
          });

        return { viewportWidth, documentWidth, outside };
      });

      if (screenshotDir) {
        await page.screenshot({
          path: path.join(screenshotDir, `${run.name}-${routeName(route)}.png`),
          fullPage: false,
          animations: "disabled",
          timeout: 15_000,
        });
      }

      const routeFailures = [];
      if (!response || response.status() >= 500) routeFailures.push(`page status ${response?.status() || "none"}`);
      if (new URL(page.url()).pathname.startsWith("/login")) routeFailures.push("redirected to login");
      if (
        sawExpectedDocumentDenial &&
        await page.getByText("Document vault is only available for VIP clients.", { exact: true }).count() === 0
      ) {
        routeFailures.push("the expected VIP access state is not visible");
      }
      if (layout.documentWidth > layout.viewportWidth + 1) {
        routeFailures.push(`document width ${layout.documentWidth}px exceeds ${layout.viewportWidth}px`);
      }
      if (layout.outside.length) routeFailures.push(`unexpected off-screen elements: ${JSON.stringify(layout.outside)}`);
      if (serverErrors.length) routeFailures.push(`server errors: ${serverErrors.join(", ")}`);
      if (consoleErrors.length) routeFailures.push(`console errors: ${[...new Set(consoleErrors)].join(" | ")}`);

      if (routeFailures.length) {
        failures.push(`${run.name} ${route}: ${routeFailures.join("; ")}`);
        console.error(`FAIL ${run.name} ${route}`);
      } else {
        console.log(`PASS ${run.name} ${route}`);
      }

      page.off("console", onConsole);
      page.off("response", onResponse);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} mobile portal QA failure(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nMobile portal QA passed on ${os.platform()} across ${runs.length} viewport profiles.`);
}
