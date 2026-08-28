import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasCommunityAudioSignature,
  hasCommunityFileSignature,
  readCommunityImageSize,
  safeCommunityFilename,
} from "../lib/community-media";

test("SHIFT community database and storage stay closed to direct authenticated access", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260828110000_shift_community.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.shift_community_messages/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.shift_community_messages FROM anon, authenticated/);
  assert.match(migration, /'shift-community-media'[\s\S]*false/);
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]+SHIFT community/i);
});

test("every community route checks active SHIFT membership on the server", async () => {
  const route = await readFile(new URL("../app/api/community/route.ts", import.meta.url), "utf8");
  const media = await readFile(new URL("../app/api/community/media/route.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../lib/community-server.ts", import.meta.url), "utf8");
  assert.match(route, /getCommunityViewer\(\)/);
  assert.match(media, /getCommunityViewer\(\)/);
  assert.match(server, /programme_type/);
  assert.match(server, /!== "shift"/);
  assert.match(server, /onboarding_status !== "active"/);
  assert.match(server, /lifecycle_status !== "active"/);
});

test("the community is only advertised to SHIFT clients and warns that it is shared", async () => {
  const mobile = await readFile(new URL("../components/portal/MobileNav.tsx", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../components/portal/Sidebar.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../components/community/ShiftCommunityClient.tsx", import.meta.url), "utf8");
  assert.match(mobile, /\/portal\/community[\s\S]+programmes: \["shift"\]/);
  assert.match(sidebar, /\/portal\/community[\s\S]+programmes: \["shift"\]/);
  assert.match(client, /Every active SHIFT client can see what is posted here/);
  assert.match(client, /Use DM for personal coaching/);
});

test("community media rejects spoofed signatures and unsafe filenames", () => {
  assert.equal(hasCommunityAudioSignature("audio/mp4", new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])), false);
  assert.equal(hasCommunityFileSignature("application/pdf", new TextEncoder().encode("not a pdf")), false);
  assert.equal(hasCommunityFileSignature("application/vnd.openxmlformats-officedocument.wordprocessingml.document", new TextEncoder().encode("PK arbitrary zip")), false);
  assert.equal(hasCommunityFileSignature("application/vnd.openxmlformats-officedocument.wordprocessingml.document", new TextEncoder().encode("PK container word/document.xml")), true);
  assert.equal(hasCommunityFileSignature("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new TextEncoder().encode("PK container xl/workbook.xml")), true);
  assert.equal(readCommunityImageSize("image/png", new Uint8Array(24)), null);
  assert.equal(safeCommunityFilename("../private\u0000/report.pdf"), "..-private-report.pdf");
});

test("client messages are positioned by user id rather than treating every client as the viewer", async () => {
  const thread = await readFile(new URL("../components/inbox/InboxThread.tsx", import.meta.url), "utf8");
  assert.match(thread, /viewerUserId \? message\.sender_user_id === viewerUserId/);
});

test("blocked service workers cannot crash community browser QA or the live portal", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /then\(function\(reg\)\{if\(!reg\)return;reg\.update\(\)/);
  assert.match(layout, /\.catch\(function\(\)\{\}\)/);
});
