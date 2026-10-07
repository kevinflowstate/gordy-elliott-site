import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  canReadCoachCheckinReplies,
  coachCheckinReplies,
  coachCheckinReplyHref,
  loadCoachCheckinReplies,
  type CoachCheckinReply,
} from "../lib/checkin-replies";

const legacy: CoachCheckinReply = {
  id: "legacy-checkin",
  created_at: "2026-10-05T09:00:00Z",
  admin_reply: "First paragraph.\n\nSecond paragraph — unchanged.",
  replied_at: "2026-10-06T13:37:00Z",
  reply_message_id: null,
};
const linked: CoachCheckinReply = {
  id: "linked-checkin",
  created_at: "2026-10-06T10:00:00Z",
  admin_reply: "New reply",
  replied_at: "2026-10-06T17:00:00Z",
  reply_message_id: "quoted-dm-id",
};

test("coach replies are entitled for SHIFT/CAPACITY coaching tiers, independently of high-touch tasks", () => {
  for (const tier of ["coached", "premium", "vip"]) assert.equal(canReadCoachCheckinReplies(tier), true);
  for (const tier of ["ai_only", "capacity", "shift", "unknown", undefined, null]) {
    assert.equal(canReadCoachCheckinReplies(tier), false);
  }
});

test("legacy and linked replies retain original content/dates, sort by reply time and omit missing/blank replies", () => {
  const answeredLate = { ...legacy, id: "older-checkin-replied-later", created_at: "2026-09-01T09:00:00Z", replied_at: "2026-10-07T12:00:00Z" };
  const missingDate = { ...legacy, id: "missing-reply-date", created_at: "2026-09-15T09:00:00Z", replied_at: null };
  const source = [legacy, { ...linked, admin_reply: null }, linked, { ...linked, admin_reply: " \n " }, missingDate, answeredLate];
  const before = JSON.stringify(source);
  const replies = coachCheckinReplies(source);
  assert.deepEqual(replies.map((reply) => reply.id), [answeredLate.id, linked.id, legacy.id, missingDate.id]);
  assert.equal(replies[2], legacy);
  assert.equal(replies[2].admin_reply, legacy.admin_reply);
  assert.equal(replies[2].replied_at, "2026-10-06T13:37:00Z");
  assert.equal(replies[3].replied_at, null, "unknown reply dates are not invented");
  assert.equal(JSON.stringify(source), before, "dashboard input is not mutated");
  assert.deepEqual(coachCheckinReplies([]), []);
});

test("new replies keep their quoted DM destination; legacy replies go directly to their visible check-in reply", () => {
  assert.equal(coachCheckinReplyHref(linked), "/portal/inbox?message=quoted-dm-id");
  assert.equal(coachCheckinReplyHref(legacy), "/portal/checkin#coach-reply-legacy-checkin");
});

test("reply history reads only the authenticated client's rows and never creates DMs or notifications", async () => {
  const requests: URL[] = [];
  const fixtures = [
    { ...legacy, client_id: "client-one" },
    { ...linked, client_id: "client-one" },
    { ...legacy, id: "private-other-checkin", admin_reply: "Other client's private reply", client_id: "client-two" },
  ];
  const admin = createClient("https://checkin-test.example.invalid", "fictional-test-key", {
    global: {
      fetch: async (input, init) => {
        assert.equal(init?.method, "GET", "history retrieval never writes");
        const url = new URL(String(input));
        requests.push(url);
        assert.equal(url.pathname, "/rest/v1/checkins");
        const clientId = url.searchParams.get("client_id");
        assert.ok(clientId?.startsWith("eq."), "client filter is mandatory");
        const rows = fixtures.filter((row) => clientId === `eq.${row.client_id}`)
          .map((row) => ({ id: row.id, created_at: row.created_at, admin_reply: row.admin_reply, replied_at: row.replied_at, reply_message_id: row.reply_message_id }));
        return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
      },
    },
  });
  for (const tier of ["coached", "premium", "vip"]) {
    const history = await loadCoachCheckinReplies(admin, "client-one", tier);
    assert.equal(history.unavailable, false);
    assert.deepEqual(history.replies.map((reply) => reply.id), [linked.id, legacy.id]);
    assert.equal(history.replies.some((reply) => reply.id === "private-other-checkin"), false);
  }
  const other = await loadCoachCheckinReplies(admin, "client-two", "coached");
  assert.deepEqual(other.replies.map((reply) => reply.id), ["private-other-checkin"]);
  assert.equal(requests[0].searchParams.get("select"), "id,created_at,admin_reply,replied_at,reply_message_id");
  assert.equal(requests[0].searchParams.get("admin_reply"), "not.is.null");
  const count = requests.length;
  assert.deepEqual(await loadCoachCheckinReplies(admin, "client-one", "ai_only"), { replies: [], unavailable: false });
  assert.equal(requests.length, count, "noncoaching tiers do not query coach reply history");
});

test("a failed reply read is distinguished from a genuinely empty history", async () => {
  const admin = createClient("https://checkin-test.example.invalid", "fictional-test-key", {
    global: { fetch: async () => new Response(JSON.stringify({ message: "fixture database unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } }) },
  });
  assert.deepEqual(await loadCoachCheckinReplies(admin, "client-one", "coached"), { replies: [], unavailable: true });
});
