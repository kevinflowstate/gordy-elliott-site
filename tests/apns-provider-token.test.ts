import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { createApnsProviderToken } from "../lib/apns-provider-token";

function credentials(curve = "prime256v1") {
  const keys = generateKeyPairSync("ec", { namedCurve: curve });
  return {
    keyId: "TESTKEY123", teamId: "TESTTEAM12",
    privateKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: keys.publicKey,
  };
}

test("creates a verifiable ES256 APNs JWT from PEM and escaped newlines", () => {
  const config = credentials();
  for (const privateKey of [config.privateKey, config.privateKey.replace(/\n/g, "\\n")]) {
    const [header, payload, signature] = createApnsProviderToken({ ...config, privateKey }, 1_000).split(".");
    assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "ES256", kid: config.keyId });
    assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), { iss: config.teamId, iat: 1_000 });
    const bytes = Buffer.from(signature, "base64url");
    assert.equal(bytes.length, 64);
    assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), { key: config.publicKey, dsaEncoding: "ieee-p1363" }, bytes), true);
  }
});

test("credential errors explain remediation without echoing key contents", () => {
  const config = credentials();
  for (const privateKey of ["SECRET-NOT-A-KEY", "-----BEGIN PRIVATE KEY-----\nSECRET-BAD-BASE64\n-----END PRIVATE KEY-----"]) {
    assert.throws(() => createApnsProviderToken({ ...config, privateKey }), (error: Error) => {
      assert.match(error.message, /APNs private key/);
      assert.ok(!error.message.includes("SECRET"));
      return true;
    });
  }
  assert.throws(() => createApnsProviderToken(credentials("secp384r1")), /P-256/);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() => createApnsProviderToken({ ...config, privateKey: rsa.privateKey.export({ format: "pem", type: "pkcs8" }).toString() }), /P-256/);
});

test("cached tokens renew after expiry and after a key rotates under the same IDs", () => {
  const config = credentials();
  const token = createApnsProviderToken(config, 2_000);
  assert.equal(createApnsProviderToken(config, 2_010), token);
  assert.notEqual(createApnsProviderToken(config, 5_000), token);
  const rotated = credentials();
  const rotatedToken = createApnsProviderToken(rotated, 5_001);
  const [header, payload, signature] = rotatedToken.split(".");
  assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), { key: rotated.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), true);
  assert.equal(verify("sha256", Buffer.from(`${header}.${payload}`), { key: config.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), false);
});
