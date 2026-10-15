import assert from "node:assert/strict";
import test from "node:test";
import { getInboxAudioPlayback, inboxAudioPlaybackUrl } from "../lib/inbox-audio-playback";

const messageId = "00000000-0000-4000-8000-000000000001";
const viewer = { userId: "user", role: "client" as const, clientProfileId: "own", fullName: "Fixture", email: "fixture@example.test" };
function fixture(row: Record<string, unknown> | null = { client_id: "own", audio_bucket: "inbox-audio", audio_path: "own/audio.m4a" }, signingError = false) {
  const filters: Record<string, unknown> = {};
  let signed = 0;
  const query = {
    select() { return this; },
    eq(key: string, value: unknown) { filters[key] = value; return this; },
    async maybeSingle() { return { data: row && (!filters.client_id || row.client_id === filters.client_id) ? row : null, error: null }; },
  };
  const admin = { from() { return query; }, storage: { from(bucket: string) {
    assert.equal(bucket, "inbox-audio");
    return { async createSignedUrl(path: string, expires: number) {
      signed++; assert.equal(path, row?.audio_path); assert.equal(expires, 600);
      return signingError ? { data: null, error: {} } : { data: { signedUrl: `https://storage.example.test/audio?token=${signed}` }, error: null };
    } };
  } } } as unknown as Parameters<typeof getInboxAudioPlayback>[2];
  return { admin, filters, signed: () => signed };
}
function request(range = "bytes=0-1023") { return new Request(`https://app.example.test${inboxAudioPlaybackUrl(messageId)}`, { headers: { Range: range } }); }

test("voice note src stays stable across polling while media requests get fresh private redirects", async () => {
  const f = fixture();
  const first = await getInboxAudioPlayback(request(), viewer, f.admin);
  const nextRange = await getInboxAudioPlayback(request("bytes=1024-2047"), viewer, f.admin);
  assert.equal(first.status, 307); assert.equal(nextRange.status, 307);
  assert.notEqual(first.headers.get("location"), nextRange.headers.get("location"));
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(f.filters, { id: messageId, message_type: "audio", client_id: "own" });
});

test("another client's audio, missing profiles and non-audio/deleted messages never get a storage URL", async () => {
  for (const row of [null, { client_id: "other", audio_bucket: "inbox-audio", audio_path: "other/private.m4a" }, { client_id: "own", audio_bucket: "inbox-images", audio_path: "own/image.png" }]) {
    const f = fixture(row);
    assert.equal((await getInboxAudioPlayback(request(), viewer, f.admin)).status, 404);
    assert.equal(f.signed(), 0);
  }
  const f = fixture();
  assert.equal((await getInboxAudioPlayback(request(), { ...viewer, clientProfileId: null }, f.admin)).status, 404);
  assert.equal(f.signed(), 0);
});

test("coach can play client audio; malformed identifiers and signing failures fail closed", async () => {
  const f = fixture({ client_id: "other", audio_bucket: "inbox-audio", audio_path: "other/audio.m4a" });
  assert.equal((await getInboxAudioPlayback(request(), { ...viewer, role: "admin" }, f.admin)).status, 307);
  assert.equal(f.filters.client_id, undefined);
  assert.equal((await getInboxAudioPlayback(new Request("https://app.example.test/api/inbox/audio?message=bad"), viewer, f.admin)).status, 400);
  assert.equal((await getInboxAudioPlayback(request(), viewer, fixture(undefined, true).admin)).status, 500);
});
