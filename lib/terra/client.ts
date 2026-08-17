import crypto from "node:crypto";
import { getSiteUrl } from "@/lib/site-url";
import { getTerraWidgetProvider, type TerraLaunchProvider } from "@/lib/terra/events";

export type TerraWidgetSession = {
  url: string;
  session_id?: string;
  status?: string;
  expires_in?: number;
  mock?: boolean;
};

export type TerraUser = {
  user_id: string;
  provider: string;
  reference_id?: string | null;
  active?: boolean;
  last_webhook_update?: string | null;
  scopes?: string | string[] | null;
  [key: string]: unknown;
};

export function getTerraConfig() {
  const devId = process.env.TERRA_DEV_ID || "";
  const apiKey = process.env.TERRA_API_KEY || "";
  const partialCredentials = Boolean(devId) !== Boolean(apiKey);
  const configured = Boolean(devId && apiKey);
  const mockMode = process.env.NODE_ENV !== "production" && (
    process.env.TERRA_MOCK_MODE === "true" || (!devId && !apiKey)
  );
  const available = configured || mockMode;

  return {
    devId,
    apiKey,
    configured,
    mockMode,
    partialCredentials,
    available,
    whoopEnabled: available && process.env.TERRA_WHOOP_ENABLED === "true",
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

type TerraFetch = typeof fetch;

type TerraWidgetSessionOptions = {
  fetchImpl?: TerraFetch;
  nativeReturn?: boolean;
};

export async function generateTerraWidgetSession(
  clientProfileId: string,
  provider: TerraLaunchProvider,
  options: TerraWidgetSessionOptions = {},
): Promise<TerraWidgetSession> {
  const config = getTerraConfig();
  const siteUrl = getSiteUrl();
  const fetchImpl = options.fetchImpl || fetch;
  const returnParams = new URLSearchParams({ provider });
  const successUrl = options.nativeReturn
    ? `${siteUrl}/connected-app-return?${new URLSearchParams({ ...Object.fromEntries(returnParams), status: "success" })}`
    : `${siteUrl}/portal/connected-apps?${new URLSearchParams({ ...Object.fromEntries(returnParams), terra: "success" })}`;
  const failureUrl = options.nativeReturn
    ? `${siteUrl}/connected-app-return?${new URLSearchParams({ ...Object.fromEntries(returnParams), status: "failed" })}`
    : `${siteUrl}/portal/connected-apps?${new URLSearchParams({ ...Object.fromEntries(returnParams), terra: "failed" })}`;

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

  const response = await fetchImpl("https://api.tryterra.co/v2/auth/generateWidgetSession", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "dev-id": config.devId,
      "x-api-key": config.apiKey,
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      providers: getTerraWidgetProvider(provider),
      language: "en",
      reference_id: getTerraReferenceId(clientProfileId),
      auth_success_redirect_url: successUrl,
      auth_failure_redirect_url: failureUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Terra could not create a connection session.");
  }

  return data as TerraWidgetSession;
}

export async function deauthenticateTerraUser(
  terraUserId: string,
  fetchImpl: TerraFetch = fetch,
) {
  const config = getTerraConfig();
  if (!config.configured) {
    throw new Error("Terra credentials are not configured.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(terraUserId)) {
    throw new Error("The stored Terra user ID is invalid.");
  }

  const url = new URL("https://api.tryterra.co/v2/auth/deauthenticateUser");
  url.searchParams.set("user_id", terraUserId);
  const response = await fetchImpl(url, {
    method: "DELETE",
    headers: {
      "dev-id": config.devId,
      "x-api-key": config.apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 404) return { status: "already_deauthenticated" as const };
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Terra could not disconnect this account.");
  }
  return { status: "success" as const };
}

export async function getTerraUsersByReferenceId(
  referenceId: string,
  fetchImpl: TerraFetch = fetch,
): Promise<TerraUser[]> {
  const config = getTerraConfig();
  if (!config.configured) {
    throw new Error("Terra credentials are not configured.");
  }

  const url = new URL("https://api.tryterra.co/v2/userInfo");
  url.searchParams.set("reference_id", referenceId);
  const response = await fetchImpl(url, {
    headers: {
      "dev-id": config.devId,
      "x-api-key": config.apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Terra could not verify this connection.");
  }

  const candidate = data?.user ?? data?.users ?? data;
  const users = Array.isArray(candidate) ? candidate : candidate && typeof candidate === "object" ? [candidate] : [];
  return users.filter((user): user is TerraUser => (
    Boolean(user)
    && typeof user === "object"
    && typeof user.user_id === "string"
    && typeof user.provider === "string"
    && (user.reference_id === undefined || user.reference_id === null || user.reference_id === referenceId)
  ));
}

export async function requestTerraNutritionData(
  terraUserId: string,
  startDate: string,
  endDate: string,
  fetchImpl: TerraFetch = fetch,
) {
  const config = getTerraConfig();
  if (!config.configured) {
    throw new Error("Terra credentials are not configured.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(terraUserId)) {
    throw new Error("The stored Terra user ID is invalid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error("The requested nutrition date range is invalid.");
  }

  const url = new URL("https://api.tryterra.co/v2/nutrition");
  url.searchParams.set("user_id", terraUserId);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("to_webhook", "true");
  const response = await fetchImpl(url, {
    headers: {
      "dev-id": config.devId,
      "x-api-key": config.apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Terra could not request nutrition data.");
  }
  return data;
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
