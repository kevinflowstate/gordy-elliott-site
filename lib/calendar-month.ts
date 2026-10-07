import type { CalendarEvent } from "./types";
import { calendarEventOccursOnDate } from "./calendar-occurrence";

export function getCalendarMonthDates(event: CalendarEvent, year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12);
    if (calendarEventOccursOnDate(event, date)) dates.push(date);
  }
  return dates;
}
