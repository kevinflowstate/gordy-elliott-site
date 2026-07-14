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
  const mockMode = process.env.TERRA_MOCK_MODE === "true" || (!devId && !apiKey);

  return {
    devId,
    apiKey,
    mockMode,
    partialCredentials,
    webhookToken: process.env.TERRA_WEBHOOK_TOKEN || process.env.TERRA_WEBHOOK_SECRET || "",
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

export function verifyTerraWebhookRequest(request: Request) {
  const { webhookToken } = getTerraConfig();
  if (!webhookToken) return process.env.NODE_ENV !== "production";

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerToken =
    request.headers.get("x-terra-webhook-token") ||
    request.headers.get("x-webhook-token") ||
    request.headers.get("x-terra-signature") ||
    "";

  return bearer === webhookToken || headerToken === webhookToken;
}
