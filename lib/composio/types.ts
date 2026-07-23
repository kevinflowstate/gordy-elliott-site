export const CALENDAR_PROVIDERS = ["google_calendar", "outlook"] as const;

export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];
export type CalendarConnectionStatus =
  | "connecting"
  | "connected"
  | "needs_reauth"
  | "disconnected"
  | "error";

export interface CalendarConnection {
  id: string;
  client_id: string;
  provider: CalendarProvider;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  status: CalendarConnectionStatus;
  last_sync_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncedCalendarEvent {
  id: string;
  client_id: string;
  connection_id: string;
  provider: CalendarProvider;
  external_event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  event_date_key: string;
  event_time: string;
  all_day: boolean;
  busy_status: string | null;
  meeting_url: string | null;
  is_cancelled: boolean;
  synced_at: string;
}

export interface NormalisedCalendarEvent {
  provider: CalendarProvider;
  external_event_id: string;
  external_event_key: string;
  calendar_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  event_date_key: string;
  event_time: string;
  all_day: boolean;
  busy_status: string | null;
  meeting_url: string | null;
  is_cancelled: boolean;
}

export function isCalendarProvider(value: unknown): value is CalendarProvider {
  return typeof value === "string" && (CALENDAR_PROVIDERS as readonly string[]).includes(value);
}

export function calendarProviderLabel(provider: CalendarProvider) {
  return provider === "google_calendar" ? "Google Calendar" : "Outlook Calendar";
}
