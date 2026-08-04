export const TERRA_LAUNCH_PROVIDERS = [
  "garmin",
  "oura",
  "fitbit",
  "myfitnesspal",
] as const;

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
  if (action === "connect") return status === "pending" || status === "connected";
  if (action === "error") return status !== "disconnected";
  return action === "disconnect";
}
