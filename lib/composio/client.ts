import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Composio } from "@composio/core";
import type { CalendarProvider } from "./types";

const TOOLKIT_VERSIONS = {
  googlecalendar: "20260721_00",
  outlook: "20260721_00",
} as const;

const PROVIDER_CONFIG = {
  google_calendar: {
    authConfigId: () => process.env.COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID || null,
    toolkit: "googlecalendar",
    tool: "GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS",
    version: TOOLKIT_VERSIONS.googlecalendar,
  },
  outlook: {
    authConfigId: () => process.env.COMPOSIO_OUTLOOK_AUTH_CONFIG_ID || null,
    toolkit: "outlook",
    tool: "OUTLOOK_GET_CALENDAR_VIEW",
    version: TOOLKIT_VERSIONS.outlook,
  },
} as const;

let composioClient: Composio | null = null;

export function getComposioConfig() {
  const apiKey = process.env.COMPOSIO_API_KEY || "";
  return {
    available: Boolean(apiKey),
    projectSlug: process.env.COMPOSIO_PROJECT_SLUG || null,
    providers: {
      google_calendar: {
        configured: Boolean(apiKey && PROVIDER_CONFIG.google_calendar.authConfigId()),
        authConfigId: PROVIDER_CONFIG.google_calendar.authConfigId(),
      },
      outlook: {
        configured: Boolean(apiKey && PROVIDER_CONFIG.outlook.authConfigId()),
        authConfigId: PROVIDER_CONFIG.outlook.authConfigId(),
      },
    },
  };
}

export function getCalendarProviderConfig(provider: CalendarProvider) {
  return {
    ...PROVIDER_CONFIG[provider],
    authConfigId: PROVIDER_CONFIG[provider].authConfigId(),
  };
}

export function getComposioClient() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) throw new Error("Connected calendars are not configured yet.");
  if (!composioClient) composioClient = new Composio({ apiKey });
  return composioClient;
}

export function getComposioUserId(clientId: string) {
  return `client:${clientId}`;
}

function callbackSigningSecret() {
  const secret = process.env.COMPOSIO_CALLBACK_SECRET || process.env.COMPOSIO_API_KEY;
  if (!secret) throw new Error("Connected calendar callback signing is not configured.");
  return secret;
}

export function createCalendarCallbackToken(connectionId: string, now = Date.now()) {
  const expiresAt = now + 15 * 60 * 1000;
  const payload = `${connectionId}.${expiresAt}`;
  const signature = createHmac("sha256", callbackSigningSecret()).update(payload).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyCalendarCallbackToken(
  connectionId: string,
  token: string,
  now = Date.now(),
) {
  const [expiresRaw, suppliedSignature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now || !suppliedSignature) return false;

  const expected = createHmac("sha256", callbackSigningSecret())
    .update(`${connectionId}.${expiresAt}`)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
