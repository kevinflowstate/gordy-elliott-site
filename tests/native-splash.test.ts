import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const infoPlist = readFileSync("ios/App/App/Info.plist", "utf8");
const project = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
const storyboard = readFileSync(
  "ios/App/App/Base.lproj/LaunchScreenV2.storyboard",
  "utf8",
);

test("native launch screen uses the versioned, centered AT CAPACITY storyboard", () => {
  assert.match(
    infoPlist,
    /<key>UILaunchStoryboardName<\/key>\s*<string>LaunchScreenV2<\/string>/,
  );
  assert.match(project, /Base\.lproj\/LaunchScreenV2\.storyboard/);
  assert.doesNotMatch(project, /Base\.lproj\/LaunchScreen\.storyboard/);
  assert.match(storyboard, /text="AT CAPACITY"/);
  assert.match(storyboard, /firstAttribute="centerX"/);
  assert.match(storyboard, /firstAttribute="centerY"/);
});
