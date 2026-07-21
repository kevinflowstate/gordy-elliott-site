import assert from "node:assert/strict";
import test from "node:test";
import {
  createApnsPayload,
  normalizeApnsToken,
  normalizeNativePushEnvironment,
} from "../lib/native-push-contract";
import { nativePushEnvironmentFromUserAgent } from "../lib/native-push-client-contract";

test("accepts APNs hexadecimal device tokens and normalises case", () => {
  const token = "ABCDEF0123456789".repeat(4);
  assert.equal(normalizeApnsToken(token), token.toLowerCase());
  assert.equal(normalizeApnsToken("not-a-token"), null);
  assert.equal(normalizeApnsToken(null), null);
});

test("creates a bounded APNs alert with a safe in-app destination", () => {
  const payload = createApnsPayload({
    title: ` Update ${"x".repeat(200)} `,
    body: ` Message ${"y".repeat(300)} `,
    url: "//outside.example/path",
    tag: `dm-${"z".repeat(100)}`,
  });

  assert.equal(payload.aps.alert.title.length, 120);
  assert.equal(payload.aps.alert.body?.length, 240);
  assert.equal(payload.aps["thread-id"]?.length, 64);
  assert.equal(payload.url, "/portal");
});

test("accepts only known APNs environments and reads the native build marker", () => {
  assert.equal(normalizeNativePushEnvironment("sandbox"), "sandbox");
  assert.equal(normalizeNativePushEnvironment("production"), "production");
  assert.equal(normalizeNativePushEnvironment("development"), null);
  assert.equal(nativePushEnvironmentFromUserAgent("Mobile SHIFT-APNS/sandbox"), "sandbox");
  assert.equal(nativePushEnvironmentFromUserAgent("Mobile SHIFT-APNS/production"), "production");
  assert.equal(nativePushEnvironmentFromUserAgent("Mobile"), "production");
});

test("bounds long in-app notification destinations", () => {
  const payload = createApnsPayload({
    title: "Update",
    url: `/portal/inbox?message=${"x".repeat(2_000)}`,
  });

  assert.equal(payload.url.length, 512);
  assert.ok(payload.url.startsWith("/portal/inbox?message="));
  assert.ok(Buffer.byteLength(JSON.stringify(payload), "utf8") < 4_096);
});
