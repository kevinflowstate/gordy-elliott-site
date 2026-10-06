import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { androidEnvironment } from "./android-environment.mjs";

if (!process.argv.includes("--accept-license")) {
  console.error("Confirm Google's Android SDK licence, then run with --accept-license: https://developer.android.com/studio#terms");
  process.exit(2);
}
if (process.arch !== "arm64" || process.platform !== "darwin") throw new Error("This installer is pinned to the Mac mini ARM64 toolchain");
const env = androidEnvironment();
if (!existsSync(join(env.JAVA_HOME, "bin", "javac"))) throw new Error("JDK21 must be installed on CodexDev first");
const tools = join(env.ANDROID_HOME, "cmdline-tools", "latest");
if (!existsSync(join(tools, "bin", "sdkmanager"))) {
  const archive = join(env.TMPDIR, "commandlinetools-mac_arm64-15859902_latest.zip");
  const checksum = "835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e";
  if (!existsSync(archive)) {
    const response = await fetch("https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip");
    if (!response.ok) throw new Error(`Official SDK download failed: HTTP ${response.status}`);
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== checksum) throw new Error("Android command-line tools checksum failed");
  const extracted = join(env.TMPDIR, "sdk-extracted");
  mkdirSync(extracted, { recursive: true });
  const unzip = spawnSync("/usr/bin/unzip", ["-q", "-o", archive, "-d", extracted], { env, stdio: "inherit" });
  if (unzip.status !== 0) process.exit(unzip.status || 1);
  mkdirSync(join(env.ANDROID_HOME, "cmdline-tools"), { recursive: true });
  renameSync(join(extracted, "cmdline-tools"), tools);
}
const sdkmanager = join(tools, "bin", "sdkmanager");
// All acceptance is gated by the explicit flag above. No licence files are fabricated.
const result = spawnSync(sdkmanager, ["--sdk_root=" + env.ANDROID_HOME, "platform-tools", "platforms;android-36", "build-tools;36.0.0"], {
  env, stdio: ["pipe", "inherit", "inherit"], input: "y\n".repeat(20),
});
if (result.status !== 0) process.exit(result.status || 1);
console.log("Android SDK platform36 and build tools are installed on CodexDev.");
