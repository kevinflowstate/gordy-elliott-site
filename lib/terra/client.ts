import crypto from "node:crypto";
import { getSiteUrl } from "@/lib/site-url";

export type TerraWidgetSession = {
  url: string;
  session_id?: string;
  status?: string;
  expires_in?: number;
  mock?: boolean;
};

export function getTerraConfig() {
  const devId = process.env.TERRA_DEV_ID || "";
  const apiKey = process.env.TERRA_API_KEY || "";
  const partialCredentials = Boolean(devId) !== Boolean(apiKey);
  const configured = Boolean(devId && apiKey);
  const mockMode = process.env.NODE_ENV !== "production" && (
    process.env.TERRA_MOCK_MODE === "true" || (!devId && !apiKey)
  );

  return {
    devId,
    apiKey,
    configured,
    mockMode,
    partialCredentials,
    available: configured || mockMode,
    webhookSigningSecret: process.env.TERRA_WEBHOOK_SIGNING_SECRET || process.env.TERRA_WEBHOOK_SECRET || "",
  };
}

export function getTerraReferenceId(clientProfileId: string) {
  return `client:${clientProfileId}`;
}

export function parseTerraReferenceId(referenceId: unknown) {
  if (typeof referenceId !== "string") return null;
  const match = referenceId.match(/^client:([0-9a-f-]{36})$/i);
  return match?.[1] || null;
}

export async function generateTerraWidgetSession(clientProfileId: string): Promise<TerraWidgetSession> {
  const config = getTerraConfig();
  const siteUrl = getSiteUrl();

  if (config.partialCredentials) {
    throw new Error("Terra is partially configured. Add both TERRA_DEV_ID and TERRA_API_KEY, or remove both to use preview mode.");
  }

  if (config.mockMode) {
    return {
      url: `${siteUrl}/portal/connected-apps?terra=mock`,
      session_id: `mock-${clientProfileId}`,
      status: "mock",
      expires_in: 900,
      mock: true,
    };
  }

  if (!config.configured) {
    throw new Error("Connected apps are not available yet.");
  }

  const response = await fetch("https://api.tryterra.co/v2/auth/generateWidgetSession", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "dev-id": config.devId,
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({
      language: "en",
      reference_id: getTerraReferenceId(clientProfileId),
      auth_success_redirect_url: `${siteUrl}/portal/connected-apps?terra=success`,
      auth_failure_redirect_url: `${siteUrl}/portal/connected-apps?terra=failed`,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Terra could not create a connection session.");
  }

  return data as TerraWidgetSession;
}

export function verifyTerraWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  signingSecret: string,
  nowMs = Date.now(),
) {
  if (!rawBody || !signatureHeader || !signingSecret) return false;

  const values = signatureHeader.split(",").reduce<Record<string, string[]>>((result, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return result;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key && value) result[key] = [...(result[key] || []), value];
    return result;
  }, {});

  const timestamp = values.t?.[0];
  const signatures = values.v1 || [];
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  const toleranceSeconds = Number(process.env.TERRA_WEBHOOK_TOLERANCE_SECONDS || 300);
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0 || ageSeconds > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature) || signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  });
}

export function verifyTerraWebhookRequest(request: Request, rawBody: string) {
  const { webhookSigningSecret } = getTerraConfig();
  if (!webhookSigningSecret) return process.env.NODE_ENV !== "production";

  return verifyTerraWebhookSignature(
    rawBody,
    request.headers.get("terra-signature") || "",
    webhookSigningSecret,
  );
}
