import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { normalizeNativePushPlatform, normalizeNativePushToken } from "../lib/native-push-contract";
import { createFcmPayload, isPermanentFcmTokenFailure } from "../lib/fcm-contract";
import { createAndroidAppLinks } from "../lib/android-app-links";
import { resolveNativeAppLink } from "../lib/native-app-links";
import { sendNativePushToUser } from "../lib/native-push-server";
import { aiReportDescription } from "../lib/ai-content-report";
import { spawnSync } from "node:child_process";

const fcmToken = `Example_FCM-Token:${"Aab_09-".repeat(25)}`;

test("Android keeps opaque token case while old iPhone registrations remain valid", () => {
  assert.equal(normalizeNativePushPlatform(undefined), "ios");
  assert.equal(normalizeNativePushPlatform("android"), "android");
  assert.equal(normalizeNativePushPlatform("web"), null);
  assert.equal(normalizeNativePushToken(` ${fcmToken} `, "android"), fcmToken);
  assert.equal(normalizeNativePushToken(fcmToken, "ios"), null);
  assert.equal(normalizeNativePushToken("ABCDEF0123456789".repeat(4), "ios"), "abcdef0123456789".repeat(4));
  for (const token of ["x", "x".repeat(4097), `${fcmToken}\n\ninvalid`, `${fcmToken}/slash`]) {
    assert.equal(normalizeNativePushToken(token, "android"), null);
  }
});

test("FCM delivers bounded coaching copy on the configured Android channel", () => {
  const payload = createFcmPayload(fcmToken, {
    title: "T".repeat(200), body: "B".repeat(400), url: "//outside.example", tag: "n".repeat(100),
  });
  assert.equal(payload.token, fcmToken);
  assert.equal(payload.notification.title.length, 120);
  assert.equal(payload.notification.body?.length, 240);
  assert.equal(payload.data.url, "/portal");
  assert.equal(payload.android.notification.channelId, "coaching_updates");
  assert.equal(payload.android.notification.tag?.length, 64);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 4096);
  assert.equal(isPermanentFcmTokenFailure("messaging/registration-token-not-registered"), true);
  for (const code of ["messaging/invalid-argument", "messaging/authentication-error", "messaging/mismatched-credential", "messaging/server-unavailable"]) {
    assert.equal(isPermanentFcmTokenFailure(code), false);
  }
});

test("Android association uses only valid public certificate fingerprints", () => {
  assert.deepEqual(createAndroidAppLinks(undefined), []);
  assert.deepEqual(createAndroidAppLinks("placeholder,not-a-cert"), []);
  const hash = Array(32).fill("AB").join(":");
  const entries = createAndroidAppLinks(`${hash.toLowerCase()},${hash},bad`);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].target.sha256_cert_fingerprints, [hash]);
  assert.equal(entries[0].target.package_name, "com.gordyelliott.atcapacity");
  assert.deepEqual(resolveNativeAppLink("https://app.onlinegordy.com/auth/confirm?token_hash=test&type=invite", "app.onlinegordy.com"), {
    action: "navigate", href: "/auth/confirm?token_hash=test&type=invite",
  });
});

test("AI reporting includes only the chosen reply and expires stale local drafts", () => {
  const now = 1000000;
  assert.match(aiReportDescription({ reply: "Selected AI reply", createdAt: now }, now) || "", /Selected AI reply/);
  assert.equal(aiReportDescription({ reply: "old", createdAt: now - 600001 }, now), null);
  assert.equal(aiReportDescription({ reply: "future", createdAt: now + 1 }, now), null);
  assert.equal(aiReportDescription({ reply: { injected: true }, createdAt: now }, now), null);
  assert.ok((aiReportDescription({ reply: "x".repeat(10000), createdAt: now }, now)?.length || 0) < 3000);
});

test("release preflight refuses missing Firebase rather than building a misleading release", () => {
  const result = spawnSync(process.execPath, ["scripts/android-release-preflight.mjs"], {
    env: { ...process.env, ANDROID_GOOGLE_SERVICES_FILE: "/nonexistent/atcapacity-google-services.json" }, encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Gordy's Firebase/);
});

test("real migration preserves iPhone devices and RLS while admitting production FCM", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(await readFile("supabase/migrations/20260721152520_add_native_push_devices.sql", "utf8"));
    const user = "00000000-0000-4000-8000-000000000001";
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.query("insert into native_push_devices(user_id,token,app_id) values ($1,$2,'com.gordyelliott.atcapacity')", [user, "a".repeat(64)]);
    await db.exec(await readFile("supabase/migrations/20261006120000_android_push_devices.sql", "utf8"));
    await db.query("insert into native_push_devices(user_id,platform,token,app_id) values ($1,'android',$2,'com.gordyelliott.atcapacity')", [user, fcmToken]);
    assert.equal((await db.query("select id from native_push_devices")).rows.length, 2);
    await assert.rejects(db.query("insert into native_push_devices(user_id,platform,token,app_id,environment) values ($1,'android',$2,'test','sandbox')", [user, fcmToken]));
    await assert.rejects(db.query("insert into native_push_devices(user_id,platform,token,app_id) values ($1,'ios',$2,'test')", [user, fcmToken]));
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from native_push_devices"));
  } finally { await db.close(); }
});

test("native delivery queries each provider separately and configuration faults do not disable tokens", async () => {
  const queries: URL[] = [];
  let updates = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    queries.push(url);
    if (request.method !== "GET") updates++;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(url.searchParams.get("platform") === "eq.android" ? [{ id: "android-id", token: fcmToken, failure_count: 0 }] : []));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, fcm: process.env.FCM_SERVICE_ACCOUNT_JSON };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "local-android-fixture-key";
    process.env.FCM_SERVICE_ACCOUNT_JSON = "{broken";
    const result = await sendNativePushToUser("fixture-user", { title: "Fixture update" });
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.subscriptionCount, 1);
    assert.match(result.reason || "", /FCM configuration is invalid/);
    assert.equal(updates, 0);
    assert.deepEqual(queries.map((url) => url.searchParams.get("platform")).sort(), ["eq.android", "eq.ios"]);
    assert.ok(queries.every((url) => url.searchParams.get("user_id") === "eq.fixture-user"));
  } finally {
    for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", previous.url], ["SUPABASE_SERVICE_ROLE_KEY", previous.key], ["FCM_SERVICE_ACCOUNT_JSON", previous.fcm]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
