import type { CalendarProvider, NormalisedCalendarEvent } from "./types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return value === true;
}

function safeWebUrl(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function dateTimeToIso(value: string | null, allDay = false) {
  if (!value) return null;
  const candidate = allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
      ? value
      : `${value}Z`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function londonParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function safeTitle(title: string | null, privacy: string | null) {
  const protectedValues = new Set(["private", "confidential", "personal"]);
  return privacy && protectedValues.has(privacy.toLowerCase()) ? "Busy" : title || "Busy";
}

function meetingUrlFromGoogle(event: UnknownRecord) {
  const hangout = safeWebUrl(event.hangoutLink);
  if (hangout) return hangout;
  const conference = asRecord(event.conferenceData);
  const entryPoints = Array.isArray(conference.entryPoints) ? conference.entryPoints : [];
  for (const entry of entryPoints) {
    const point = asRecord(entry);
    if (point.entryPointType === "video") {
      const uri = safeWebUrl(point.uri);
      if (uri) return uri;
    }
  }
  return safeWebUrl(event.display_url) || safeWebUrl(event.htmlLink);
}

function meetingUrlFromOutlook(event: UnknownRecord) {
  const meeting = asRecord(event.onlineMeeting);
  return safeWebUrl(meeting.joinUrl) || safeWebUrl(event.onlineMeetingUrl) || safeWebUrl(event.webLink);
}

function normaliseGoogle(payload: unknown): NormalisedCalendarEvent[] {
  const root = asRecord(payload);
  const data = asRecord(root.data && asRecord(root.data).events ? root.data : root);
  const rows = Array.isArray(data.events) ? data.events : [];
  const normalised: NormalisedCalendarEvent[] = [];

  for (const rowValue of rows) {
    const row = asRecord(rowValue);
    const event = asRecord(row.event);
    const externalId = asString(event.id);
    const calendarId = asString(row.source_calendar_id);
    const start = asRecord(event.start);
    const end = asRecord(event.end);
    const allDay = Boolean(asString(start.date) && !asString(start.dateTime));
    const startsAt = dateTimeToIso(asString(start.dateTime) || asString(start.date), allDay);
    const endsAt = dateTimeToIso(asString(end.dateTime) || asString(end.date), allDay);
    if (!externalId || !startsAt || !endsAt) continue;

    const local = allDay
      ? { date: asString(start.date)!, time: "00:00" }
      : londonParts(startsAt);
    normalised.push({
      provider: "google_calendar",
      external_event_id: externalId,
      external_event_key: ["google_calendar", calendarId || "primary", externalId, startsAt].join(":"),
      calendar_id: calendarId,
      title: safeTitle(asString(event.summary), asString(event.visibility)),
      starts_at: startsAt,
      ends_at: endsAt,
      event_date_key: local.date,
      event_time: local.time,
      all_day: allDay,
      busy_status: asString(event.transparency) === "transparent" ? "free" : "busy",
      meeting_url: meetingUrlFromGoogle(event),
      is_cancelled: asString(event.status) === "cancelled",
    });
  }
  return normalised;
}

function normaliseOutlook(payload: unknown): NormalisedCalendarEvent[] {
  const root = asRecord(payload);
  const data = asRecord(root.data && asRecord(root.data).value ? root.data : root);
  const rows = Array.isArray(data.value) ? data.value : [];
  const normalised: NormalisedCalendarEvent[] = [];

  for (const rowValue of rows) {
    const event = asRecord(rowValue);
    const externalId = asString(event.id);
    const start = asRecord(event.start);
    const end = asRecord(event.end);
    const allDay = asBoolean(event.isAllDay);
    const startsAt = dateTimeToIso(asString(start.dateTime), false);
    const endsAt = dateTimeToIso(asString(end.dateTime), false);
    if (!externalId || !startsAt || !endsAt) continue;

    const local = londonParts(startsAt);
    normalised.push({
      provider: "outlook",
      external_event_id: externalId,
      external_event_key: ["outlook", "primary", externalId, startsAt].join(":"),
      calendar_id: null,
      title: safeTitle(asString(event.subject), asString(event.sensitivity)),
      starts_at: startsAt,
      ends_at: endsAt,
      event_date_key: local.date,
      event_time: allDay ? "00:00" : local.time,
      all_day: allDay,
      busy_status: asString(event.showAs),
      meeting_url: meetingUrlFromOutlook(event),
      is_cancelled: asBoolean(event.isCancelled),
    });
  }
  return normalised;
}

export function normaliseCalendarEvents(
  provider: CalendarProvider,
  payload: unknown,
) {
  return provider === "google_calendar"
    ? normaliseGoogle(payload)
    : normaliseOutlook(payload);
}
