import { createHmac, timingSafeEqual } from "node:crypto";

function callbackSigningSecret() {
  const secret = process.env.COMPOSIO_CALLBACK_SECRET || process.env.COMPOSIO_API_KEY;
  if (!secret) throw new Error("Connected calendar callback signing is not configured.");
  return secret;
}

export function createCalendarCallbackToken(
  connectionId: string,
  nativeReturn = false,
  now = Date.now(),
) {
  const expiresAt = now + 15 * 60 * 1000;
  const payload = `${connectionId}.${nativeReturn ? "native" : "web"}.${expiresAt}`;
  const signature = createHmac("sha256", callbackSigningSecret()).update(payload).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyCalendarCallbackToken(
  connectionId: string,
  token: string,
  nativeReturn = false,
  now = Date.now(),
) {
  const [expiresRaw, suppliedSignature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now || !suppliedSignature) return false;

  const expected = createHmac("sha256", callbackSigningSecret())
    .update(`${connectionId}.${nativeReturn ? "native" : "web"}.${expiresAt}`)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
