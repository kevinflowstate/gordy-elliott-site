export const MANUAL_CALENDAR_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
export const MANUAL_CALENDAR_SYNC_BURST_WINDOW_MS = 60 * 1000;

export function manualCalendarSyncRetryAfterSeconds(
  lastSyncAt: string | null,
  nowMs = Date.now(),
): number {
  if (!lastSyncAt) return 0;
  const lastSyncMs = new Date(lastSyncAt).getTime();
  if (!Number.isFinite(lastSyncMs)) return 0;
  return Math.max(0, Math.ceil((lastSyncMs + MANUAL_CALENDAR_SYNC_COOLDOWN_MS - nowMs) / 1000));
}
