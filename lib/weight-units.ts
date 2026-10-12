import type { CheckinFormConfig } from "@/lib/types";
export type WeightUnit = "kg" | "lb";
export function isWeightUnit(value: unknown): value is WeightUnit { return value === "kg" || value === "lb"; }
export function weightToKg(value: number, unit: WeightUnit) { return unit === "lb" ? value * 0.45359237 : value; }
export function weightFromKg(value: number, unit: WeightUnit) { return unit === "lb" ? value / 0.45359237 : value; }
export function weightDisplay(valueKg: number, unit: WeightUnit) { return Number(weightFromKg(valueKg, unit).toFixed(1)); }
export function convertWeightInput(value: string, from: WeightUnit, to: WeightUnit) {
  if (!value.trim() || !Number.isFinite(Number(value))) return value;
  return String(Number(weightFromKg(weightToKg(Number(value), from), to).toFixed(1)));
}
export function checkinConfigForWeightUnit(config: CheckinFormConfig, unit: WeightUnit): CheckinFormConfig {
  if (config.programme_type === "boardroom") return config;
  return { ...config, progress_tracking: config.progress_tracking?.map(metric => {
    if (metric.id !== "weight") return metric;
    const from = isWeightUnit(metric.unit) ? metric.unit : "kg";
    return { ...metric, unit,
      ...(metric.min !== undefined ? { min: weightFromKg(weightToKg(metric.min, from), unit) } : {}),
      ...(metric.max !== undefined ? { max: weightFromKg(weightToKg(metric.max, from), unit) } : {}),
    };
  }) };
}
