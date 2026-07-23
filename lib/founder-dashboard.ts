import type { CalendarEvent } from "@/lib/types";

export function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function calendarEventOccursOn(event: CalendarEvent, date: Date) {
  const eventDate = event.event_date.slice(0, 10);
  const start = new Date(`${eventDate}T${event.event_time || "09:00"}:00`);
  if (Number.isNaN(start.getTime()) || eventDate > localDateKey(date)) return false;

  if (event.recurrence === "none") return eventDate === localDateKey(date);
  if (event.recurrence === "monthly") return start.getDate() === date.getDate();

  const recurrenceDay = event.recurrence_day ?? start.getDay();
  const dayMatches = recurrenceDay === date.getDay();
  if (!dayMatches) return false;
  if (event.recurrence === "weekly") return true;

  const [startYear, startMonth, startDay] = eventDate.split("-").map(Number);
  const startOrdinal = Date.UTC(startYear, startMonth - 1, startDay) / (24 * 60 * 60 * 1000);
  const dateOrdinal = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000);
  const firstOccurrenceOrdinal = startOrdinal + ((recurrenceDay - start.getDay() + 7) % 7);
  const weeks = (dateOrdinal - firstOccurrenceOrdinal) / 7;
  return weeks >= 0 && weeks % 2 === 0;
}

export function calendarWindowLoad(events: CalendarEvent[], startDate: Date, length = 7) {
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      dateKey: localDateKey(date),
      count: events.filter((event) => calendarEventOccursOn(event, date)).length,
    };
  });
}

export function isCurrentWearableSummary(summaryDate: string, now = new Date()) {
  return summaryDate.slice(0, 10) === localDateKey(now);
}
