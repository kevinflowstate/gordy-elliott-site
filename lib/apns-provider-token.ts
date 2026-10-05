import { createHash, createPrivateKey, sign } from "node:crypto";

type ProviderCredentials = { keyId: string; teamId: string; privateKey: string };

let cachedToken: { value: string; createdAt: number; cacheKey: string } | null = null;

/** Fail before opening APNs connections, without exposing credential material. */
export function createApnsProviderToken(credentials: ProviderCredentials, now = Math.floor(Date.now() / 1000)) {
  const pem = credentials.privateKey.replace(/\\n/g, "\n").trim();
  if (!pem.startsWith("-----BEGIN PRIVATE KEY-----") || !pem.endsWith("-----END PRIVATE KEY-----")) {
    throw new Error("APNs private key must contain the complete PKCS#8 .p8 key, including its BEGIN/END PRIVATE KEY lines.");
  }

  let key;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new Error("APNs private key cannot be decoded. Replace APNS_PRIVATE_KEY with the complete, unmodified APNs .p8 key.");
  }
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("APNs private key must be an Apple APNs authentication key using the P-256 curve (ES256).");
  }

  // Rotation can reuse the same Apple key/team IDs; never reuse a token signed by
  // a different key. The fingerprint remains local and is not logged.
  const cacheKey = `${credentials.teamId}:${credentials.keyId}:${createHash("sha256").update(pem).digest("hex")}`;
  if (cachedToken?.cacheKey === cacheKey && now >= cachedToken.createdAt && now - cachedToken.createdAt < 50 * 60) {
    return cachedToken.value;
  }
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: credentials.keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: credentials.teamId, iat: now })).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  const value = `${unsigned}.${signature.toString("base64url")}`;
  cachedToken = { value, createdAt: now, cacheKey };
  return value;
}
