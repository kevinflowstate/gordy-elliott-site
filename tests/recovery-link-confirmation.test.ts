import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, POST } from '../app/auth/callback/route';
import { recoveryDestination } from '../lib/recovery-links';

test('existing recovery and invite links can be previewed repeatedly without consuming their token', async () => {
  // No Next request cookies or Supabase credentials exist in this test. Any token
  // exchange would throw: a GET must do nothing except take us to confirmation.
  for (const type of ['recovery', 'invite']) {
    const url = `https://app.onlinegordy.com/auth/callback?token_hash=${'a'.repeat(56)}&type=${type}&redirect=%2Fportal%2Fsettings%3Fsetup%3Dtrue`;
    for (let preview = 0; preview < 3; preview++) {
      const response = await GET(new Request(url));
      const location = new URL(response.headers.get('location')!);
      assert.equal(location.pathname, '/auth/confirm');
      assert.equal(location.searchParams.get('token_hash'), 'a'.repeat(56));
      assert.equal(location.searchParams.get('type'), type);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin');
    }
  }
});

test('cross-site and originless form submissions cannot redeem a password link', async () => {
  for (const origin of [null, 'https://attacker.example', 'null']) {
    const response = await POST(new Request('https://app.onlinegordy.com/auth/callback', {
      method: 'POST', headers: origin ? { origin } : {},
      body: new URLSearchParams({ token_hash: 'a'.repeat(56), type: 'recovery' }),
    }));
    assert.equal(response.status, 403);
  }
});

test('malformed and unsupported tokens reach the recovery screen without using auth', async () => {
  const cases: Record<string, string>[] = [{ token_hash: 'bad', type: 'recovery' }, { token_hash: 'a'.repeat(56), type: 'magiclink' }, {}];
  for (const values of cases) {
    const response = await POST(new Request('https://app.onlinegordy.com/auth/callback', {
      method: 'POST', headers: { origin: 'https://app.onlinegordy.com' }, body: new URLSearchParams(values),
    }));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://app.onlinegordy.com/auth/confirm?error=setup_link_invalid');
  }
});

test('confirmation cannot redirect credentials or people outside password setup', () => {
  for (const destination of ['https://attacker.example', '//attacker.example', '/admin', '/auth/callback', null]) {
    assert.equal(recoveryDestination(destination), '/portal/settings?setup=true');
  }
  assert.equal(recoveryDestination('/portal/settings?reset=true'), '/portal/settings?reset=true');
});
