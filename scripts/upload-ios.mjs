import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
const archivePath = process.env.IOS_ARCHIVE_PATH
  || path.join(releaseRoot, `${releaseSlug}-${identity.version}-${identity.build}.xcarchive`);
const exportRoot = process.env.IOS_EXPORT_PATH
  || path.join(releaseRoot, `upload-${identity.version}-${identity.build}`);
const exportOptionsJson = path.join(releaseRoot, `ExportOptions-${identity.version}-${identity.build}.json`);
const exportOptionsPlist = path.join(releaseRoot, `ExportOptions-${identity.version}-${identity.build}.plist`);
const profileName = process.env.IOS_PROVISIONING_PROFILE || `${identity.appName} App Store`;

await access(archivePath);
await mkdir(exportRoot, { recursive: true });

const exportOptions = {
  method: "app-store-connect",
  destination: "upload",
  teamID: identity.appleTeamId,
  signingStyle: "manual",
  provisioningProfiles: {
    [identity.bundleId]: profileName,
  },
  manageAppVersionAndBuildNumber: false,
  stripSwiftSymbols: true,
  uploadSymbols: true,
};

await writeFile(exportOptionsJson, `${JSON.stringify(exportOptions, null, 2)}\n`);
const convert = spawnSync("plutil", ["-convert", "xml1", "-o", exportOptionsPlist, exportOptionsJson], {
  encoding: "utf8",
});
if (convert.status !== 0) {
  throw new Error(convert.stderr.trim() || "Could not create the App Store export options plist.");
}

console.log(`Uploading ${identity.appName} ${identity.version} (${identity.build}) to App Store Connect`);
const upload = spawnSync("xcodebuild", [
  "-exportArchive",
  "-archivePath", archivePath,
  "-exportPath", exportRoot,
  "-exportOptionsPlist", exportOptionsPlist,
  "-allowProvisioningUpdates",
], { stdio: "inherit" });

if (upload.status !== 0) process.exit(upload.status || 1);
console.log(`Upload accepted by App Store Connect for processing: ${identity.version} (${identity.build})`);
