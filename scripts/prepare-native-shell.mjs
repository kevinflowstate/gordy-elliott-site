import { writeFile } from "node:fs/promises";
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
