import type { CalendarEvent } from "@/lib/types";

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function civilDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function calendarEventOccursOnDate(event: CalendarEvent, date: Date): boolean {
  if (!event.is_active) return false;
  const eventDateKey = event.event_date.slice(0, 10);
  const baseDate = new Date(`${eventDateKey}T12:00:00`);
  if (!Number.isFinite(baseDate.getTime())) return false;
  if (dateKey(date) < eventDateKey) return false;
  if (event.recurrence === "none") return dateKey(date) === eventDateKey;

  const targetDay = event.recurrence_day ?? baseDate.getDay();
  if (event.recurrence === "weekly") return date.getDay() === targetDay;
  if (event.recurrence === "biweekly") {
    if (date.getDay() !== targetDay) return false;
    const weeks = Math.floor((civilDayNumber(date) - civilDayNumber(baseDate)) / 7);
    return weeks >= 0 && weeks % 2 === 0;
  }
  return date.getDate() === baseDate.getDate();
}

export function getNextCalendarOccurrence(event: CalendarEvent, now = new Date()): Date | null {
  const eventDateKey = event.event_date.slice(0, 10);
  const eventTime = event.all_day ? "12:00" : event.event_time || "00:00";
  const baseDate = new Date(`${eventDateKey}T${eventTime}:00`);
  if (!Number.isFinite(baseDate.getTime())) return null;

  if (event.recurrence === "none") {
    if (event.all_day && eventDateKey === dateKey(now)) return now;
    return baseDate >= now ? baseDate : null;
  }

  const [hours, minutes] = eventTime.split(":").map(Number);
  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate < baseDate || (!event.all_day && candidate < now)) continue;

    const targetDay = event.recurrence_day ?? baseDate.getDay();
    if (event.recurrence === "weekly" && candidate.getDay() === targetDay) return candidate;
    if (event.recurrence === "biweekly" && candidate.getDay() === targetDay) {
      const weeks = Math.floor((candidate.getTime() - baseDate.getTime()) / (7 * 86_400_000));
      if (weeks >= 0 && weeks % 2 === 0) return candidate;
    }
    if (event.recurrence === "monthly" && candidate.getDate() === baseDate.getDate()) return candidate;
  }
  return null;
}
