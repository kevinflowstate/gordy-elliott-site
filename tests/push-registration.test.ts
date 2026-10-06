import assert from "node:assert/strict";
import test from "node:test";
import { readyPushServiceWorker, syncWebPushRegistration } from "../lib/web-push-registration";
import { postPushRegistration } from "../lib/push-registration-client";

const currentKey = new Uint8Array([1, 2, 3]);

function fixture(options: { existing?: boolean; stale?: boolean; canUnsubscribe?: boolean } = {}) {
  const calls: string[] = [];
  const subscription = {
    options: { applicationServerKey: options.stale ? new Uint8Array([9, 9, 9]).buffer : currentKey.buffer },
    unsubscribe: async () => { calls.push("unsubscribe"); return options.canUnsubscribe !== false; },
    toJSON: () => ({ endpoint: "https://push.example.invalid/fixture", keys: { p256dh: "fixture", auth: "fixture" } }),
  } as unknown as PushSubscription;
  const registration = { pushManager: {
    getSubscription: async () => options.existing ? subscription : null,
    subscribe: async () => { calls.push("subscribe"); return subscription; },
  } } as unknown as ServiceWorkerRegistration;
  return { calls, registration };
}

test("existing browser permission/subscription is not success when the server rejects registration", async () => {
  const { registration, calls } = fixture({ existing: true });
  assert.equal(await syncWebPushRegistration(registration, currentKey, false, async () => false), false);
  assert.deepEqual(calls, []);
  // Retrying uses the same local endpoint and requires server acceptance.
  assert.equal(await syncWebPushRegistration(registration, currentKey, true, async () => true), true);
  assert.deepEqual(calls, []);
});

test("a background check does not request a new browser subscription", async () => {
  const { registration, calls } = fixture();
  assert.equal(await syncWebPushRegistration(registration, currentKey, false, async () => { throw new Error("unexpected sync"); }), false);
  assert.deepEqual(calls, []);
});

test("explicit enable creates and synchronises a missing endpoint", async () => {
  const { registration, calls } = fixture();
  let sent: PushSubscriptionJSON | undefined;
  assert.equal(await syncWebPushRegistration(registration, currentKey, true, async (payload) => { sent = payload; return true; }), true);
  assert.deepEqual(calls, ["subscribe"]);
  assert.equal(sent?.endpoint, "https://push.example.invalid/fixture");
});

test("a rotated VAPID key removes the obsolete endpoint and enables a replacement on request", async () => {
  const { registration, calls } = fixture({ existing: true, stale: true });
  assert.equal(await syncWebPushRegistration(registration, currentKey, true, async () => true), true);
  assert.deepEqual(calls, ["unsubscribe", "subscribe"]);
});

test("failed removal of an obsolete endpoint cannot report success", async () => {
  const { registration, calls } = fixture({ existing: true, stale: true, canUnsubscribe: false });
  assert.equal(await syncWebPushRegistration(registration, currentKey, true, async () => { throw new Error("unexpected sync"); }), false);
  assert.deepEqual(calls, ["unsubscribe"]);
});

test("the service worker check returns the ready registration", async () => {
  const { registration } = fixture();
  const worker = { ready: Promise.resolve(registration) } as unknown as ServiceWorkerContainer;
  assert.equal(await readyPushServiceWorker(worker), registration);
});

test("a service worker that never starts has a bounded wait", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const worker = { ready: new Promise(() => {}) } as unknown as ServiceWorkerContainer;
  const pending = readyPushServiceWorker(worker);
  const assertion = assert.rejects(pending, /Notification service is not ready/);
  context.mock.timers.tick(10_000);
  await assertion;
});

test("both registration channels report rejected server saves as failures", async (context) => {
  context.mock.method(globalThis, "fetch", async (_url: string, request: RequestInit) => {
    assert.equal(request.method, "POST");
    assert.equal(request.body, JSON.stringify({ token: "qa-only" }));
    assert.ok(request.signal);
    return new Response("{}", { status: 503 });
  });
  assert.equal(await postPushRegistration("/api/push/native", { token: "qa-only" }), false);
  assert.equal(await postPushRegistration("/api/push/subscribe", { token: "qa-only" }), false);
});

test("a hung registration request aborts so clients can retry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(globalThis, "fetch", (_url: string, request: RequestInit) => new Promise((_, reject) => {
    request.signal!.addEventListener("abort", () => reject(new Error("registration timed out")));
  }));
  const pending = postPushRegistration("/api/push/native", { token: "qa-only" });
  const assertion = assert.rejects(pending, /registration timed out/);
  context.mock.timers.tick(15_000);
  await assertion;
});
