import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const expected = {
  appId: "com.gordyelliott.shift",
  teamId: "H4J3XX8R8M",
  version: "1.0",
  build: "2",
};

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

if (process.platform !== "darwin") {
  throw new Error("The iOS release preflight must run on macOS.");
}

const serverUrl = new URL(process.env.CAPACITOR_SERVER_URL || "https://gordy-elliott-site.vercel.app");
if (serverUrl.protocol !== "https:") {
  throw new Error("CAPACITOR_SERVER_URL must use HTTPS.");
}

const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
const infoPath = "ios/App/App/Info.plist";
await Promise.all([access(projectPath), access(infoPath)]);

const project = await readFile(projectPath, "utf8");
const checks = [
  [project.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${expected.appId};`), `bundle ID ${expected.appId}`],
  [project.includes(`DEVELOPMENT_TEAM = ${expected.teamId};`), `team ${expected.teamId}`],
  [project.includes(`MARKETING_VERSION = ${expected.version};`), `version ${expected.version}`],
  [project.includes(`CURRENT_PROJECT_VERSION = ${expected.build};`), `build ${expected.build}`],
];

for (const [passed, label] of checks) {
  if (!passed) throw new Error(`iOS project does not contain the expected ${label}.`);
}

const xcode = run("xcodebuild", ["-version"]);
if (xcode.status !== 0) throw new Error(xcode.stderr.trim() || "Xcode is not available.");

const identities = run("security", ["find-identity", "-v", "-p", "codesigning"]);
if (identities.status !== 0 || !identities.stdout.includes(`Apple Distribution: Kevin Harkin (${expected.teamId})`)) {
  throw new Error("The SHIFT Apple Distribution signing identity is not available in the keychain.");
}

console.log([
  "iOS release preflight passed.",
  `- App: SHIFT Coaching ${expected.version} (${expected.build})`,
  `- Bundle: ${expected.appId}`,
  `- Team: ${expected.teamId}`,
  `- Server: ${serverUrl.origin}`,
  `- ${xcode.stdout.trim().replace(/\n/g, " / ")}`,
].join("\n"));
