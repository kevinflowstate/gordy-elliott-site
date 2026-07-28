import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helperUrl = new URL("../lib/storm-warning-server.ts", import.meta.url);
const portalRouteUrl = new URL("../app/api/portal/storm-warning/route.ts", import.meta.url);
const scanRouteUrl = new URL("../app/api/admin/capacity-scan/route.ts", import.meta.url);

test("portal and admin scans use the same bounded warning writer", async () => {
  const [helper, portalRoute, scanRoute] = await Promise.all([
    readFile(helperUrl, "utf8"),
    readFile(portalRouteUrl, "utf8"),
    readFile(scanRouteUrl, "utf8"),
  ]);

  assert.match(helper, /admin\.rpc\("log_client_storm_warning"/);
  assert.match(portalRoute, /persistStormWarning\(admin, profile\.id, evaluation\)/);
  assert.match(scanRoute, /persistStormWarning\(admin, clientId, evaluation\)/);

  assert.doesNotMatch(portalRoute, /\.from\("client_storm_warnings"\)/);
  assert.doesNotMatch(scanRoute, /\.from\("client_storm_warnings"\)/);
});
