import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createAppReviewBrowserCookies } from "./lib/app-review-browser-auth.mjs";

const baseUrl = process.env.PORTAL_QA_BASE_URL || "http://127.0.0.1:4190";
const outputDir = process.env.PORTAL_QA_SCREENSHOT_DIR || path.join(process.cwd(), "output/playwright/inbox-photo");
const chromePath = process.env.PORTAL_QA_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAe4R03YAAAAASUVORK5CYII=", "base64");
const displayedImage = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#6e246d"/><circle cx="400" cy="260" r="140" fill="#e040d0"/><text x="400" y="500" fill="white" text-anchor="middle" font-size="54">PRIVATE DM PHOTO</text></svg>');

await mkdir(outputDir, { recursive: true });
const cookies = await createAppReviewBrowserCookies({ baseUrl });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  for (const viewport of [
    { name: "iphone-se", width: 320, height: 568 },
    { name: "iphone", width: 390, height: 844 },
    { name: "iphone-large", width: 430, height: 932 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    await context.addCookies(cookies);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.route("**/api/inbox/thread", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ clientId: "qa-client", clientName: "Demo Client", clientEmail: "demo@flowstatesystems.ai", viewerUserId: "qa-user", messages: [] }),
    }));
    await page.route("**/api/inbox/image", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: {
        id: `qa-image-${viewport.name}`,
        client_id: "qa-client",
        sender_user_id: "qa-user",
        sender_role: "client",
        message: "",
        message_type: "image",
        image_url: displayedImage,
        image_width: 800,
        image_height: 600,
        read_by_admin: false,
        read_by_client: true,
        created_at: new Date().toISOString(),
      } }),
    }));

    const response = await page.goto(`${baseUrl}/portal/inbox`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 500 || new URL(page.url()).pathname.startsWith("/login")) {
      throw new Error(`${viewport.name}: authenticated inbox did not load.`);
    }
    await page.getByPlaceholder("Message Gordy...").waitFor();
    await page.locator('input[aria-label="Choose a photo"]').setInputFiles({ name: "qa-photo.png", mimeType: "image/png", buffer: png });
    await page.getByRole("dialog", { name: "Preview photo" }).waitFor();
    await page.getByText("Send this photo?", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-preview.png`), animations: "disabled" });
    await page.getByRole("button", { name: "Send photo" }).click();
    await page.getByAltText("Photo you sent").waitFor();
    await page.getByRole("button", { name: "Open your photo" }).click();
    await page.getByRole("dialog", { name: "Viewing your photo" }).waitFor();
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-fullscreen.png`), animations: "disabled" });
    await page.getByRole("button", { name: "Close photo" }).click();

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      threadBottom: document.querySelector(".portal-dm-thread")?.getBoundingClientRect().bottom ?? Infinity,
    }));
    if (layout.documentWidth > layout.viewportWidth + 1 || layout.threadBottom > viewport.height + 1) {
      throw new Error(`${viewport.name}: photo DM overflowed its mobile viewport (${JSON.stringify(layout)}).`);
    }
    if (errors.length) throw new Error(`${viewport.name}: browser errors: ${[...new Set(errors)].join(" | ")}`);
    console.log(`PASS ${viewport.name} photo preview, send, message and fullscreen`);
    await context.close();
  }
} finally {
  await browser.close();
}
