import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

// Do not override HOME: every heavy tool has its own documented storage setting.
export function androidEnvironment() {
  const root = process.env.ANDROID_BUILD_ROOT || "/Volumes/CodexDev";
  if (!existsSync(root)) throw new Error(`Android build disk is unavailable: ${root}`);
  const caches = join(root, "Developer-Caches");
  const tools = join(root, "Developer-Tools");
  const javaHome = process.env.JAVA_HOME || join(tools, "Java", "temurin-21");
  const sdk = process.env.ANDROID_HOME || join(tools, "Android", "sdk");
  const paths = {
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdk,
    ANDROID_USER_HOME: join(caches, "android-user"),
    ANDROID_EMULATOR_HOME: join(caches, "android-emulator"),
    ANDROID_AVD_HOME: join(caches, "android-avd"),
    GRADLE_USER_HOME: join(caches, "gradle"),
    npm_config_cache: join(caches, "npm"),
    TMPDIR: join(caches, "android-tmp"),
  };
  for (const [name, path] of Object.entries(paths)) {
    mkdirSync(path, { recursive: true });
    if (!realpathSync(path).startsWith(`${realpathSync(root)}/`)) {
      throw new Error(`${name} must resolve onto ${root}, received ${path}`);
    }
  }
  return {
    ...process.env,
    ...paths,
    JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS || ""} -Djava.io.tmpdir=${paths.TMPDIR}`.trim(),
    PATH: `${join(javaHome, "bin")}:${join(sdk, "platform-tools")}:${join(sdk, "cmdline-tools", "latest", "bin")}:${process.env.PATH}`,
  };
}
