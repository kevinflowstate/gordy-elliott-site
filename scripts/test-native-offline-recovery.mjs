import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Run after prepare-native-shell: exercise the exact document copied into the
// native app, with no network or sibling resources available.
const html = await readFile(new URL("../native-shell/offline.html", import.meta.url), "utf8");
assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i);
const image = html.match(/<img[^>]*src="([^"]+)"/i)?.[1];
assert.ok(image?.startsWith("data:image/png;base64,"), "offline branding must be bundled inline");
const icon = await readFile(new URL("../native-shell/at-capacity-icon-512x512.png", import.meta.url));
assert.deepEqual(Buffer.from(image.split(",")[1], "base64"), icon);

let destination;
const window = { location: { replace(url) { destination = url; } } };
const context = { window, URL };
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) runInNewContext(script, context);
assert.equal(typeof context.retryShift, "function");
context.retryShift();
assert.equal(destination, new URL("/portal", process.env.CAPACITOR_SERVER_URL).href);
console.log("PASS: standalone offline branding and reconnect without external resources");
