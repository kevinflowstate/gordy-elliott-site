export const TERRA_LAUNCH_PROVIDERS = [
  "garmin",
  "oura",
  "fitbit",
  "myfitnesspal",
  "whoop",
] as const;

export const TERRA_CONSENT_VERSION = "wearable_connection_v2";
export const TERRA_PENDING_TIMEOUT_MS = 15 * 60 * 1000;

export function isTerraConnectionAttemptExpired(
  connection: { status: string; consented_at?: string | null; updated_at?: string | null },
  now = Date.now(),
) {
  if (connection.status !== "pending") return false;
  const startedAt = Date.parse(connection.consented_at || connection.updated_at || "");
  return !Number.isFinite(startedAt) || now - startedAt >= TERRA_PENDING_TIMEOUT_MS;
}

export function matchesTerraConnectionAttempt(consentedAt: string | null | undefined, attempt: unknown) {
  if (typeof attempt !== "string" || !consentedAt) return false;
  const expected = Date.parse(consentedAt);
  return Number.isFinite(expected) && expected === Date.parse(attempt);
}

export type TerraLaunchProvider = (typeof TERRA_LAUNCH_PROVIDERS)[number];
export type TerraEventAction = "healthcheck" | "connect" | "disconnect" | "error" | "data" | "ignore";
export type TerraConnectionStatus = "connected" | "disconnected" | "pending" | "error";

const DATA_EVENT_TYPES = new Set([
  "activity",
  "daily",
  "nutrition",
  "sleep",
]);

const INFORMATIONAL_EVENT_TYPES = new Set([
  "large_request_processing",
  "large_request_sending",
  "permission_change",
  "processing",
  "rate_limit_hit",
  "s3_payload",
  "s3_upload",
]);

export function normaliseTerraProvider(value: unknown): TerraLaunchProvider | null {
  if (typeof value !== "string") return null;
  const provider = value.trim().toLowerCase().replace(/[\s_-]/g, "");
  return TERRA_LAUNCH_PROVIDERS.find((candidate) => candidate === provider) || null;
}

export function getTerraWidgetProvider(provider: TerraLaunchProvider) {
  return provider.toUpperCase();
}

export function normaliseTerraScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((scope): scope is string => typeof scope === "string")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function classifyTerraEvent(eventType: unknown, authStatus?: unknown): TerraEventAction {
  const type = typeof eventType === "string" ? eventType.trim().toLowerCase() : "";
  const status = typeof authStatus === "string" ? authStatus.trim().toLowerCase() : "";

  if (type === "healthcheck") return "healthcheck";
  if (type === "deauth" || type === "access_revoked") return "disconnect";
  if (type === "connection_error" || type === "google_no_datasource") return "error";
  if (type === "auth") return status === "success" ? "connect" : "error";
  if (type === "user_reauth") return "connect";
  if (DATA_EVENT_TYPES.has(type)) return "data";
  if (INFORMATIONAL_EVENT_TYPES.has(type)) return "ignore";
  return "ignore";
}

export function canApplyTerraEvent(action: TerraEventAction, status: TerraConnectionStatus) {
  if (action === "data") return status === "pending" || status === "connected";
  if (action === "connect") return status === "pending" || status === "connected" || status === "error";
  if (action === "error") return status !== "disconnected";
  return action === "disconnect";
}

export function canApplyTerraUserEvent(
  action: TerraEventAction,
  status: TerraConnectionStatus,
  storedUserId: string | null,
  eventUserIds: string[],
) {
  if (!canApplyTerraEvent(action, status)) return false;
  // Retained historical data from the previous account does not confirm a new authorisation.
  if (status === "pending" && action === "data" && storedUserId && eventUserIds.includes(storedUserId)) return false;
  // Late revocations/errors for an earlier Terra user must not break its replacement.
  if ((action === "error" || action === "disconnect") && storedUserId && eventUserIds.length && !eventUserIds.includes(storedUserId)) return false;
  return true;
}
