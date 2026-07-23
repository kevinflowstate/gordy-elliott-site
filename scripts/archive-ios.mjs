import { access, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import path from "node:path";

async function resolveStorageRoot() {
  const candidates = process.env.IOS_STORAGE_ROOT
    ? [process.env.IOS_STORAGE_ROOT]
    : ["/Volumes/XCode", "/Volumes/XCode/Storage-Quarantine-2026-07-15"];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.W_OK);
      return candidate;
    } catch {
      // Try the next configured Xcode storage location.
    }
  }

  throw new Error("No writable Xcode storage location was found. Set IOS_STORAGE_ROOT to a writable folder.");
}

const storageRoot = await resolveStorageRoot();
const identity = JSON.parse(await readFile("config/app-identity.json", "utf8"));
const releaseSlug = identity.appName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const releaseRoot = process.env.IOS_RELEASE_ROOT || path.join(storageRoot, `${releaseSlug}-Releases`);
const derivedDataPath = process.env.IOS_DERIVED_DATA_PATH || path.join(storageRoot, `${releaseSlug}-DerivedData`, `build-${identity.build}`);
const archivePath = process.env.IOS_ARCHIVE_PATH || path.join(releaseRoot, `${releaseSlug}-${identity.version}-${identity.build}.xcarchive`);

await Promise.all([mkdir(releaseRoot, { recursive: true }), mkdir(derivedDataPath, { recursive: true })]);

const args = [
  "-project", "ios/App/App.xcodeproj",
  "-scheme", "App",
  "-configuration", "Release",
  "-destination", "generic/platform=iOS",
  "-archivePath", archivePath,
  "-derivedDataPath", derivedDataPath,
  "-allowProvisioningUpdates",
  "archive",
];

console.log(`Creating App Store archive at ${archivePath}`);
const result = spawnSync("xcodebuild", args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);

console.log(`Archive created: ${archivePath}`);
console.log("The archive has not been uploaded. Validate it in Xcode Organizer before distribution.");
