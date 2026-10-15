import { dateKeyInTimeZone } from '@/lib/founder-dashboard';
export const checkinToday = (now = new Date()) => dateKeyInTimeZone(now, 'Europe/London');
export const addCheckinDays = (date: string, n: number) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const checkinWeekStart = (date: string) => addCheckinDays(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7));
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export function scheduledCheckinDates(start: string | null | undefined, day: string | null | undefined, today = checkinToday()) {
    const found = days.indexOf((day || 'monday').toLowerCase());
    const target = found < 0 ? 1 : found;
    const current = new Date(today + 'T12:00:00Z').getUTCDay();
    let date = addCheckinDays(today, -((current - target + 7) % 7));
    const floor = addCheckinDays(today, -364);
    const lower = start && start.slice(0, 10) > floor ? start.slice(0, 10) : floor;
    const result: string[] = [];
    for (let i = 0; i < 53 && date >= lower; i++, date = addCheckinDays(date, -7))
        result.push(date);
    return result;
}
export function scheduledCheckinError(date: unknown, dates: string[]) { return typeof date !== 'string' || !dates.includes(date) ? 'Choose an outstanding scheduled check-in date on or before today.' : null; }

export function checkinEffectiveDate(checkin: {scheduled_date?: string | null; created_at: string}) { return checkin.scheduled_date || checkinToday(new Date(checkin.created_at)); }
export function checkinInWeek(checkin: {scheduled_date?: string | null; created_at: string}, today = checkinToday()) { return checkinWeekStart(checkinEffectiveDate(checkin)) === checkinWeekStart(today); }
