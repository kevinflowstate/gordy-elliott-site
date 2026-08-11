import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveNativeAppLink } from "../lib/native-app-links";

const APP_ID = "H4J3XX8R8M.com.gordyelliott.shift";
const DOMAIN = "applinks:app.onlinegordy.com";

test("the website and signed iOS target declare the same recovery universal link", async () => {
  const [associationSource, entitlements, project, appDelegate, bridge, nextConfig] = await Promise.all([
    readFile("public/.well-known/apple-app-site-association", "utf8"),
    readFile("ios/App/App/App.entitlements", "utf8"),
    readFile("ios/App/App.xcodeproj/project.pbxproj", "utf8"),
    readFile("ios/App/App/AppDelegate.swift", "utf8"),
    readFile("components/native/NativeAppBridge.tsx", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);

  const association = JSON.parse(associationSource);
  const details = association.applinks?.details;

  assert.ok(Array.isArray(details));
  assert.deepEqual(details, [{ appID: APP_ID, paths: ["/auth/callback"] }]);
  assert.match(entitlements, new RegExp(DOMAIN.replaceAll(".", "\\.")));
  assert.match(project, /com\.apple\.AssociatedDomains/);
  assert.match(appDelegate, /continue userActivity: NSUserActivity/);
  assert.match(appDelegate, /ApplicationDelegateProxy\.shared\.application\(application, continue: userActivity/);
  assert.match(bridge, /resolveNativeAppLink\(url, window\.location\.host\)/);
  assert.match(nextConfig, /source: "\/\.well-known\/apple-app-site-association"/);
  assert.match(nextConfig, /key: "Content-Type", value: "application\/json"/);
});

test("the native router accepts the verified recovery URL and preserves its token", () => {
  assert.deepEqual(
    resolveNativeAppLink(
      "https://app.onlinegordy.com/auth/callback?token_hash=secret&type=recovery&redirect=%2Fportal%2Fsettings%3Freset%3Dtrue",
      "app.onlinegordy.com",
    ),
    {
      action: "navigate",
      href: "/auth/callback?token_hash=secret&type=recovery&redirect=%2Fportal%2Fsettings%3Freset%3Dtrue",
    },
  );
});

test("the native router rejects hostile origins, schemes and unrecognised custom routes", () => {
  assert.equal(
    resolveNativeAppLink("https://evil.example/auth/callback?token_hash=secret", "app.onlinegordy.com"),
    null,
  );
  assert.equal(resolveNativeAppLink("javascript:alert(1)", "app.onlinegordy.com"), null);
  assert.equal(resolveNativeAppLink("shiftcoaching://delete-account", "app.onlinegordy.com"), null);
});

test("legacy app links remain bounded to login and portal routes", () => {
  assert.deepEqual(resolveNativeAppLink("shiftcoaching://portal/training?session=1", "app.onlinegordy.com"), {
    action: "navigate",
    href: "/portal/training?session=1",
  });
  assert.deepEqual(
    resolveNativeAppLink("shiftcoaching://login?redirect=https%3A%2F%2Fevil.example", "app.onlinegordy.com"),
    { action: "navigate", href: "/login?redirect=%2Fportal" },
  );
});

test("account recovery links retain the bearer token on the verified HTTPS callback", async () => {
  const [accountLinks, callback] = await Promise.all([
    readFile("lib/account-links.ts", "utf8"),
    readFile("app/auth/callback/route.ts", "utf8"),
  ]);

  assert.match(accountLinks, /new URL\("\/auth\/callback", getSiteUrl\(\)\)/);
  assert.match(accountLinks, /url\.searchParams\.set\("token_hash", tokenHash\)/);
  assert.doesNotMatch(accountLinks, /shiftcoaching:/);
  assert.match(callback, /supabase\.auth\.verifyOtp\(\{ token_hash: tokenHash, type \}\)/);
  assert.match(callback, /\/portal\/settings\?reset=true/);
});

test("Build 6 is the only configured native candidate", async () => {
  const [identitySource, project] = await Promise.all([
    readFile("config/app-identity.json", "utf8"),
    readFile("ios/App/App.xcodeproj/project.pbxproj", "utf8"),
  ]);
  const identity = JSON.parse(identitySource);

  assert.equal(identity.build, "6");
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 6;/g) || []).length, 2);
  assert.doesNotMatch(project, /CURRENT_PROJECT_VERSION = 5;/);
});
