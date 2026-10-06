import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { androidEnvironment } from "./android-environment.mjs";

const env = androidEnvironment();
const root = env.ANDROID_BUILD_ROOT || "/Volumes/CodexDev";
if (!realpathSync(process.cwd()).startsWith(`${realpathSync(root)}/`)) {
  throw new Error(`The Android worktree and output must live on ${root}`);
}
const mode = process.argv[2] || "debug";
if (!["debug", "release", "lint"].includes(mode)) throw new Error("Use debug, release or lint");
const signingPath = process.env.ANDROID_SIGNING_CONFIG || join(root, "Projects", "AT-CAPACITY-Releases", "android", "signing", "signing.json");
if (mode === "release" && existsSync(signingPath)) Object.assign(env, JSON.parse(readFileSync(signingPath, "utf8")));
if (mode === "release") {
  const result = spawnSync(process.execPath, ["scripts/android-release-preflight.mjs"], { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!existsSync(join(env.JAVA_HOME, "bin", "javac"))) throw new Error(`Install JDK 21 on CodexDev: ${env.JAVA_HOME}`);
if (!existsSync(join(env.ANDROID_HOME, "platforms", "android-36", "android.jar"))) {
  throw new Error("Install Android SDK platform 36 using sdkmanager on CodexDev first.");
}
mkdirSync(resolve("android"), { recursive: true });
writeFileSync(resolve("android/local.properties"), `sdk.dir=${env.ANDROID_HOME}\n`);
const sync = spawnSync(process.execPath, ["scripts/sync-android.mjs"], { env, stdio: "inherit" });
if (sync.status !== 0) process.exit(sync.status || 1);
const task = mode === "release" ? "bundleRelease" : mode === "lint" ? "lintDebug" : "assembleDebug";
const result = spawnSync(resolve("android/gradlew"), [task, "--no-daemon", "--max-workers=2", "--console=plain"], {
  cwd: resolve("android"), env, stdio: "inherit",
});
process.exit(result.status ?? 1);
