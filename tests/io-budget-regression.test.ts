import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { hasUnreadIncomingMessages } from "../lib/inbox-client";
import type { InboxMessage } from "../lib/types";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("navigation badges use visible-only five-minute polling and inbox consumers share one store", () => {
  const inboxHook = read("components/inbox/useInboxUnreadCount.ts");
  const sidebar = read("components/portal/Sidebar.tsx");

  assert.match(inboxHook, /useSyncExternalStore/);
  assert.match(inboxHook, /const listeners = new Set/);
  assert.match(inboxHook, /POLL_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(inboxHook, /document\.hidden/);
  assert.match(inboxHook, /visibilitychange/);
  assert.match(sidebar, /setInterval\([\s\S]+?5 \* 60 \* 1000\)/);
  assert.match(sidebar, /document\.hidden/);
  assert.match(sidebar, /visibilitychange/);
});

test("open inbox views stop their fast refresh while backgrounded", () => {
  const clientInbox = read("components/inbox/ClientInboxClient.tsx");
  const adminInbox = read("components/inbox/AdminInboxClient.tsx");

  assert.match(clientInbox, /if \(!document\.hidden\) void loadThread\(\)/);
  assert.match(clientInbox, /visibilitychange/);
  assert.match(adminInbox, /if \(!document\.hidden\) void loadConversations\(\)/);
  assert.match(adminInbox, /if \(!document\.hidden\) void loadThread\(selectedClientId\)/);
});

test("DM refreshes mark read only when an inbound unread message exists", () => {
  const baseMessage = {
    id: "message-id",
    client_id: "client-id",
    sender_user_id: "sender-id",
    sender_role: "admin",
    message: "Hello",
    created_at: "2026-08-08T08:00:00.000Z",
    read_by_admin: true,
    read_by_client: true,
  } satisfies InboxMessage;

  assert.equal(hasUnreadIncomingMessages([{ ...baseMessage, sender_role: "admin", read_by_client: false }], "client"), true);
  assert.equal(hasUnreadIncomingMessages([{ ...baseMessage, sender_role: "client", read_by_admin: false }], "admin"), true);
  assert.equal(hasUnreadIncomingMessages([baseMessage], "client"), false);
  assert.equal(hasUnreadIncomingMessages([baseMessage], "admin"), false);

  const readRoute = read("app/api/inbox/read/route.ts");
  assert.match(readRoute, /\.eq\(readColumn, false\)/);
});

test("Terra retries do not rewrite identical raw payloads or completed summaries", () => {
  const terraWebhook = read("app/api/integrations/terra/webhook/route.ts");

  assert.match(terraWebhook, /CONNECTION_REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(terraWebhook, /ignoreDuplicates: true/);
  assert.match(terraWebhook, /\.select\("id"\)/);
  assert.match(terraWebhook, /duplicateAlreadyApplied/);
  assert.match(terraWebhook, /source_payload_ids\?\.includes\(event\.id\)/);
  assert.doesNotMatch(terraWebhook, /client_wearable_events"\)[\s\S]*?\.select\("\*"\)/);
});
