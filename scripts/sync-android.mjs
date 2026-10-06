import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { androidEnvironment } from "./android-environment.mjs";
import appIdentity from "../config/app-identity.json" with { type: "json" };

const env = { ...androidEnvironment(), CAPACITOR_SERVER_URL: process.env.CAPACITOR_SERVER_URL || appIdentity.productionUrl };
const services = process.env.ANDROID_GOOGLE_SERVICES_FILE;
if (services) {
  if (!existsSync(services)) throw new Error("ANDROID_GOOGLE_SERVICES_FILE does not exist");
  copyFileSync(services, resolve("android/app/google-services.json"));
}
for (const [command, args] of [
  [process.execPath, ["scripts/prepare-native-shell.mjs"]],
  [resolve("node_modules/.bin/cap"), ["sync", "android"]],
]) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
