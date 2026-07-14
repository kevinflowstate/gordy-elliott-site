import type { TrafficLight } from "@/lib/types";

export const ATTENTION_SIGNALS = [
  "login",
  "checkin",
  "training",
  "daily_metrics",
  "nutrition",
  "wearables",
] as const;

export const CLIENT_LIFECYCLE_STATUSES = ["active", "paused", "access_frozen"] as const;

export const MONITORING_FIELDS = [
  "monitor_login",
  "monitor_checkins",
  "monitor_training",
  "monitor_daily_metrics",
  "monitor_nutrition",
  "monitor_wearables",
] as const;

export type AttentionSignal = (typeof ATTENTION_SIGNALS)[number];
export type ClientLifecycleStatus = (typeof CLIENT_LIFECYCLE_STATUSES)[number];
export type MonitoringField = (typeof MONITORING_FIELDS)[number];

export interface ClientMonitoringPreferences {
  monitor_login: boolean;
  monitor_checkins: boolean;
  monitor_training: boolean;
  monitor_daily_metrics: boolean;
  monitor_nutrition: boolean;
  monitor_wearables: boolean;
}

export interface ClientAttentionSnooze {
  signal: AttentionSignal;
  ignored: boolean;
  snoozed_until: string | null;
  reason?: string | null;
}

export interface ClientAttentionReason {
  signal: AttentionSignal;
  label: string;
  detail: string;
  severity: Exclude<TrafficLight, "green">;
  days_since: number;
}

export const DEFAULT_MONITORING_PREFERENCES: ClientMonitoringPreferences = {
  monitor_login: true,
  monitor_checkins: true,
  monitor_training: false,
  monitor_daily_metrics: false,
  monitor_nutrition: false,
  monitor_wearables: false,
};

export function resolveClientLifecycleStatus(
  status: string | null | undefined,
  resumesAt: string | null | undefined,
  now = Date.now(),
): ClientLifecycleStatus {
  if (status !== "paused" && status !== "access_frozen") return "active";
  if (resumesAt && new Date(resumesAt).getTime() <= now) return "active";
  return status;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(value: string | null | undefined, fallback: string, now: number) {
  const timestamp = new Date(value || fallback).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / DAY_MS));
}

export function isAttentionSnoozeActive(snooze: ClientAttentionSnooze, now = Date.now()) {
  if (snooze.ignored) return true;
  return Boolean(snooze.snoozed_until && new Date(snooze.snoozed_until).getTime() > now);
}

function isSuppressed(signal: AttentionSignal, snoozes: ClientAttentionSnooze[], now: number) {
  const snooze = snoozes.find((item) => item.signal === signal);
  return snooze ? isAttentionSnoozeActive(snooze, now) : false;
}

function addReason(
  reasons: ClientAttentionReason[],
  signal: AttentionSignal,
  label: string,
  days: number,
  amberAfter: number,
  redAfter: number,
) {
  if (days <= amberAfter) return;
  const severity = days > redAfter ? "red" : "amber";
  reasons.push({
    signal,
    label,
    severity,
    days_since: days,
    detail: `${days} day${days === 1 ? "" : "s"} since ${label.toLowerCase()}`,
  });
}

export function computeClientAttention(input: {
  lifecycleStatus?: ClientLifecycleStatus | null;
  createdAt: string;
  lastLogin?: string | null;
  lastCheckin?: string | null;
  lastTraining?: string | null;
  lastDailyMetric?: string | null;
  lastNutrition?: string | null;
  lastWearableSync?: string | null;
  hasActiveTrainingPlan?: boolean;
  hasActiveNutritionPlan?: boolean;
  hasWearableConnection?: boolean;
  preferences?: Partial<ClientMonitoringPreferences> | null;
  snoozes?: ClientAttentionSnooze[];
  now?: number;
}): { status: TrafficLight; reasons: ClientAttentionReason[] } {
  if (input.lifecycleStatus && input.lifecycleStatus !== "active") {
    return { status: "green", reasons: [] };
  }

  const now = input.now ?? Date.now();
  const preferences = { ...DEFAULT_MONITORING_PREFERENCES, ...(input.preferences || {}) };
  const snoozes = input.snoozes || [];
  const reasons: ClientAttentionReason[] = [];

  if (preferences.monitor_login && !isSuppressed("login", snoozes, now)) {
    addReason(reasons, "login", "portal activity", daysSince(input.lastLogin, input.createdAt, now), 7, 10);
  }
  if (preferences.monitor_checkins && !isSuppressed("checkin", snoozes, now)) {
    addReason(reasons, "checkin", "last check-in", daysSince(input.lastCheckin, input.createdAt, now), 7, 14);
  }
  if (preferences.monitor_training && input.hasActiveTrainingPlan && !isSuppressed("training", snoozes, now)) {
    addReason(reasons, "training", "last completed training session", daysSince(input.lastTraining, input.createdAt, now), 7, 14);
  }
  if (preferences.monitor_daily_metrics && !isSuppressed("daily_metrics", snoozes, now)) {
    addReason(reasons, "daily_metrics", "last Daily Tracker entry", daysSince(input.lastDailyMetric, input.createdAt, now), 3, 7);
  }
  if (preferences.monitor_nutrition && input.hasActiveNutritionPlan && !isSuppressed("nutrition", snoozes, now)) {
    addReason(reasons, "nutrition", "last nutrition log", daysSince(input.lastNutrition, input.createdAt, now), 3, 7);
  }
  if (preferences.monitor_wearables && input.hasWearableConnection && !isSuppressed("wearables", snoozes, now)) {
    addReason(reasons, "wearables", "last wearable sync", daysSince(input.lastWearableSync, input.createdAt, now), 3, 7);
  }

  const status: TrafficLight = reasons.some((reason) => reason.severity === "red")
    ? "red"
    : reasons.length > 0
      ? "amber"
      : "green";

  reasons.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return b.days_since - a.days_since;
  });

  return { status, reasons };
}

export const ATTENTION_SIGNAL_LABELS: Record<AttentionSignal, string> = {
  login: "Portal activity",
  checkin: "Weekly check-ins",
  training: "Training sessions",
  daily_metrics: "Daily Tracker",
  nutrition: "Nutrition tracking",
  wearables: "Wearable sync",
};
