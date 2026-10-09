import type { CheckIn, CheckinFormConfig, ProgressMetric } from './types';
export type BusinessMetricTrend = { key: string; metric: ProgressMetric; points: { date: string; value: number }[] };
export function businessMetricTrends(checkins: CheckIn[], current?: CheckinFormConfig | null): BusinessMetricTrend[] {
  const series = new Map<string, BusinessMetricTrend>();
  for (const checkin of [...checkins].sort((a,b) => a.created_at.localeCompare(b.created_at))) {
    const schema = checkin.form_config_snapshot || current;
    if (schema?.programme_type !== 'boardroom') continue;
    for (const metric of schema.progress_tracking || []) {
      if (!metric.enabled || metric.type === 'select') continue;
      const raw = checkin.responses?.[metric.id];
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const key = `${metric.id}:${metric.kind || metric.type}:${metric.unit || ''}`;
      const trend = series.get(key) || { key, metric, points: [] };
      trend.points.push({ date: checkin.created_at, value });
      series.set(key, trend);
    }
  }
  return [...series.values()];
}
export function formatBusinessMetric(metric: ProgressMetric, value: number) {
  if (metric.kind === 'money' || metric.unit === '£') return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value);
  return `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(value)}${metric.unit ? ` ${metric.unit}` : ''}`;
}
