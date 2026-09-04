import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { revokeExternalProviderAccess } from "../app/api/portal/account/route";
import { getSiteUrl } from "../lib/site-url";

test("account deletion revokes live providers with injected dependencies only", async () => {
  const terraCalls: string[] = [];
  const composioDeletes: string[] = [];
  const composioLists: string[] = [];

  await revokeExternalProviderAccess(
    [
      { terra_user_id: "terra-live", raw_user: {} },
      { terra_user_id: "terra-live", raw_user: {} },
      { terra_user_id: "terra-mock", raw_user: { mock: true } },
      { terra_user_id: null, raw_user: {} },
    ],
    [
      { composio_user_id: "client:one", composio_connected_account_id: "calendar-live" },
      { composio_user_id: "client:one", composio_connected_account_id: null },
    ],
    {
      async deauthenticateTerraUser(id) { terraCalls.push(id); },
      async deleteComposioConnectedAccount(id) { composioDeletes.push(id); },
      async listComposioConnectedAccountIds(userId) {
        composioLists.push(userId);
        return [];
      },
    },
  );

  assert.deepEqual(terraCalls, ["terra-live"]);
  assert.deepEqual(composioDeletes, ["calendar-live"]);
  assert.deepEqual(composioLists, []);
});

test("a failed Composio delete is accepted only when remote absence is confirmed", async () => {
  await revokeExternalProviderAccess(
    [],
    [{ composio_user_id: "client:one", composio_connected_account_id: "already-gone" }],
    {
      async deauthenticateTerraUser() {},
      async deleteComposioConnectedAccount() { throw new Error("not found"); },
      async listComposioConnectedAccountIds() { return []; },
    },
  );

  await assert.rejects(
    revokeExternalProviderAccess(
      [],
      [{ composio_user_id: "client:one", composio_connected_account_id: "still-live" }],
      {
        async deauthenticateTerraUser() {},
        async deleteComposioConnectedAccount() { throw new Error("temporary failure"); },
        async listComposioConnectedAccountIds() { return ["still-live"]; },
      },
    ),
    /temporary failure/,
  );
});

test("account deletion cleans external access and community media before deleting auth", async () => {
  const source = await readFile(
    new URL("../app/api/portal/account/route.ts", import.meta.url),
    "utf8",
  );
  const revokeIndex = source.lastIndexOf("await revokeExternalProviderAccess(");
  const communityIndex = source.lastIndexOf("removeStoragePaths(admin, COMMUNITY_MEDIA_BUCKET");
  const authDeleteIndex = source.lastIndexOf("admin.auth.admin.deleteUser(user.id)");

  assert.ok(revokeIndex > -1 && communityIndex > revokeIndex);
  assert.ok(authDeleteIndex > communityIndex);
  assert.match(source, /if \(wearableError \|\| calendarError\) throw/);
});

test("client inbox listing fails closed before creating a service-role client", async () => {
  const source = await readFile(new URL("../lib/inbox-server.ts", import.meta.url), "utf8");
  const functionStart = source.indexOf("export async function listInboxConversations");
  const failClosedIndex = source.indexOf('if (viewer.role === "client" && !viewer.clientProfileId) return [];', functionStart);
  const adminIndex = source.indexOf("const admin = createAdminClient();", functionStart);

  assert.ok(functionStart > -1 && failClosedIndex > functionStart);
  assert.ok(adminIndex > failClosedIndex);
});

test("site URL configuration is trimmed, canonical and fails safely", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  try {
    process.env.NEXT_PUBLIC_SITE_URL = "  https://app.example.test/path/  ";
    process.env.VERCEL_URL = " ignored.example.test ";
    assert.equal(getSiteUrl(), "https://app.example.test");

    process.env.NEXT_PUBLIC_SITE_URL = " javascript:alert(1) ";
    process.env.VERCEL_URL = " preview.example.test ";
    assert.equal(getSiteUrl(), "https://preview.example.test");

    process.env.NEXT_PUBLIC_SITE_URL = " ";
    process.env.VERCEL_URL = " https://preview.example.test/some/path ";
    assert.equal(getSiteUrl(), "https://preview.example.test");
  } finally {
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = originalVercelUrl;
  }
});
