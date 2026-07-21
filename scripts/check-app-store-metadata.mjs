import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const metadataPath = resolve("docs/app-store-metadata.md");
const projectPath = resolve("ios/App/App.xcodeproj/project.pbxproj");
const infoPlistPath = resolve("ios/App/App/Info.plist");
const metadata = readFileSync(metadataPath, "utf8");
const project = readFileSync(projectPath, "utf8");

function fail(message) {
  console.error(`App Store metadata check failed: ${message}`);
  process.exit(1);
}

function tableValue(field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = metadata.match(new RegExp(`^\\| ${escapedField} \\| (.+) \\|$`, "m"));

  if (!match) fail(`missing ${field} in ${metadataPath}`);
  return match[1].trim();
}

function sectionValue(heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = metadata.match(
    new RegExp(`^## ${escapedHeading}\\n\\n([\\s\\S]*?)(?=\\n\\n## |$)`, "m"),
  );

  if (!match) fail(`missing ${heading} in ${metadataPath}`);
  return match[1].trim().replace(/^`|`$/g, "");
}

const fields = [
  ["Name", tableValue("Name"), 30],
  ["Subtitle", tableValue("Subtitle"), 30],
  ["Promotional text", sectionValue("Promotional text"), 170],
  ["Keywords", sectionValue("Keywords"), 100],
];

for (const [name, value, maximum] of fields) {
  if (value.length > maximum) {
    fail(`${name} is ${value.length} characters; Apple's maximum is ${maximum}`);
  }
}

const targetedDeviceFamilies = [...project.matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)].map(
  ([, value]) => value.trim().replaceAll('"', ""),
);

if (targetedDeviceFamilies.length !== 2 || targetedDeviceFamilies.some((value) => value !== "1")) {
  fail("the iOS target must remain iPhone-only in both Debug and Release configurations");
}

const plist = execFileSync("plutil", ["-p", infoPlistPath], { encoding: "utf8" });
if (plist.includes("UISupportedInterfaceOrientations~ipad")) {
  fail("Info.plist still declares iPad orientations");
}

console.log(
  `App Store metadata passed: ${fields
    .map(([name, value, maximum]) => `${name}=${value.length}/${maximum}`)
    .join(", ")}; iPhone-only target confirmed.`,
);
