import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rawServerUrl = process.env.CAPACITOR_SERVER_URL;
if (!rawServerUrl) {
  throw new Error("CAPACITOR_SERVER_URL is required to prepare the native shell.");
}

const serverUrl = new URL(rawServerUrl);
if (serverUrl.protocol !== "https:") {
  throw new Error("CAPACITOR_SERVER_URL must use HTTPS for iOS App Transport Security.");
}

const outputPath = fileURLToPath(new URL("../native-shell/runtime-config.js", import.meta.url));
const runtimeConfig = `window.__SHIFT_NATIVE_CONFIG__ = Object.freeze(${JSON.stringify({
  serverUrl: serverUrl.origin,
})});\n`;

await writeFile(outputPath, runtimeConfig, "utf8");

// Android serves the error document locally but proxies its sibling requests
// when server.url is configured. Keep recovery independent of those requests.
const offlineTemplate = await readFile(new URL("./templates/native-offline.html", import.meta.url), "utf8");
const icon = await readFile(new URL("../native-shell/at-capacity-icon-512x512.png", import.meta.url));
const offlineHtml = offlineTemplate
  .replace('src="at-capacity-icon-512x512.png"', `src="data:image/png;base64,${icon.toString("base64")}"`)
  .replace('<script src="runtime-config.js"></script>', `<script>${runtimeConfig.replaceAll("<", "\\u003c")}</script>`);
await writeFile(new URL("../native-shell/offline.html", import.meta.url), offlineHtml, "utf8");
