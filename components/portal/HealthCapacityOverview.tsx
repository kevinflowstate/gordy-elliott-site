"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import type { WearableConnection, WearableDailySummary } from "@/lib/wearable-insights";
import { titleCaseProvider } from "@/lib/wearable-insights";

type SignalCategory = "overview" | "sleep" | "activity" | "heart" | "nutrition";
type MetricKey =
  | "sleep_minutes"
  | "sleep_score"
  | "hrv_ms"
  | "resting_hr_bpm"
  | "steps"
  | "active_calories"
  | "training_load"
  | "workout_count"
  | "nutrition_calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "water_ml";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  category: Exclude<SignalCategory, "overview">;
  accent: "cyan" | "mint" | "magenta" | "amber";
  format: (value: number) => string;
};

const METRICS: MetricDefinition[] = [
  { key: "sleep_minutes", label: "Sleep", category: "sleep", accent: "magenta", format: formatMinutes },
  { key: "sleep_score", label: "Sleep score", category: "sleep", accent: "magenta", format: (value) => `${Math.round(value)}/100` },
  { key: "hrv_ms", label: "HRV", category: "heart", accent: "mint", format: (value) => `${Math.round(value)} ms` },
  { key: "resting_hr_bpm", label: "Resting heart rate", category: "heart", accent: "cyan", format: (value) => `${Math.round(value)} bpm` },
  { key: "steps", label: "Steps", category: "activity", accent: "cyan", format: (value) => Math.round(value).toLocaleString("en-GB") },
  { key: "active_calories", label: "Active calories", category: "activity", accent: "amber", format: (value) => `${Math.round(value)} kcal` },
  { key: "training_load", label: "Training load", category: "activity", accent: "magenta", format: (value) => Math.round(value).toLocaleString("en-GB") },
  { key: "workout_count", label: "Workouts", category: "activity", accent: "mint", format: (value) => `${Math.round(value)}` },
  { key: "nutrition_calories", label: "Calories logged", category: "nutrition", accent: "amber", format: (value) => `${Math.round(value).toLocaleString("en-GB")} kcal` },
  { key: "protein_g", label: "Protein", category: "nutrition", accent: "cyan", format: (value) => `${Math.round(value)} g` },
  { key: "carbs_g", label: "Carbohydrate", category: "nutrition", accent: "magenta", format: (value) => `${Math.round(value)} g` },
  { key: "fat_g", label: "Fat", category: "nutrition", accent: "amber", format: (value) => `${Math.round(value)} g` },
  { key: "water_ml", label: "Water", category: "nutrition", accent: "mint", format: (value) => `${(value / 1000).toFixed(1)} L` },
];

const ACCENTS = {
  cyan: {
    text: "text-[#63c9f1]",
    line: "#63c9f1",
    glow: "bg-[radial-gradient(circle_at_82%_18%,rgba(62,167,216,0.19),transparent_48%)]",
  },
  mint: {
    text: "text-[#58d6b0]",
    line: "#58d6b0",
    glow: "bg-[radial-gradient(circle_at_82%_18%,rgba(52,188,151,0.17),transparent_48%)]",
  },
  magenta: {
    text: "text-[#ef68db]",
    line: "#ef68db",
    glow: "bg-[radial-gradient(circle_at_82%_18%,rgba(224,64,208,0.16),transparent_48%)]",
  },
  amber: {
    text: "text-[#f2b968]",
    line: "#f2b968",
    glow: "bg-[radial-gradient(circle_at_82%_18%,rgba(226,157,58,0.15),transparent_48%)]",
  },
} as const;

const CATEGORY_COPY: Record<SignalCategory, { label: string; icon: string; heading: string }> = {
  overview: { label: "Overview", icon: "spark", heading: "Today at a glance" },
  sleep: { label: "Sleep", icon: "moon", heading: "Sleep and restoration" },
  activity: { label: "Activity", icon: "bolt", heading: "Movement and training" },
  heart: { label: "HRV", icon: "heart", heading: "Heart & recovery" },
  nutrition: { label: "Nutrition", icon: "drop", heading: "Nutrition logged" },
};

export default function HealthCapacityOverview({
  summaries,
  connections,
  loading,
  refreshing,
  onRefresh,
  onManageConnections,
}: {
  summaries: WearableDailySummary[];
  connections: WearableConnection[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onManageConnections: () => void;
}) {
  const orderedSummaries = useMemo(
    () => [...summaries].sort((a, b) => b.summary_date.localeCompare(a.summary_date)),
    [summaries],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [category, setCategory] = useState<SignalCategory>("overview");
  const selected = orderedSummaries[Math.min(selectedIndex, Math.max(orderedSummaries.length - 1, 0))] || null;
  const hasNutrition = connections.some(
    (connection) => connection.provider === "myfitnesspal" && connection.status === "connected",
  ) || orderedSummaries.some((summary) => summary.providers.includes("myfitnesspal"));
  const connectedProviders = connections.filter((connection) => connection.status === "connected");
  const categories = (Object.keys(CATEGORY_COPY) as SignalCategory[]).filter(
    (item) => item !== "nutrition" || hasNutrition,
  );
  const visibleMetrics = useMemo(() => {
    const categoryMetrics = category === "overview"
      ? [
          selected?.sleep_minutes !== null && selected?.sleep_minutes !== undefined ? "sleep_minutes" : "sleep_score",
          "steps",
          "hrv_ms",
          "resting_hr_bpm",
          "training_load",
        ] as MetricKey[]
      : METRICS.filter((metric) => metric.category === category).map((metric) => metric.key);
    return categoryMetrics
      .filter((key, index, keys) => keys.indexOf(key) === index)
      .map((key) => METRICS.find((metric) => metric.key === key))
      .filter((metric): metric is MetricDefinition => Boolean(metric));
  }, [category, selected?.sleep_minutes]);

  if (loading && !selected) return <HealthOverviewSkeleton />;

  if (!selected) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-28 sm:pb-8">
        <HealthHeader
          connectedProviders={connectedProviders}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onManageConnections={onManageConnections}
        />
        <section className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-[#151318] px-6 py-12 text-center sm:px-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#ef68db]">
            <SignalIcon name="heart" className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Your health picture starts here</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
            Connect a wearable and AT CAPACITY will turn sleep, recovery and activity into a clear daily coaching signal.
          </p>
          <button
            type="button"
            onClick={onManageConnections}
            className="mt-6 min-h-12 rounded-full bg-[#e440d0] px-6 text-sm font-bold text-white shadow-[0_14px_34px_-16px_rgba(228,64,208,0.8)]"
          >
            Connect a wearable
          </button>
        </section>
      </div>
    );
  }

  const score = selected.readiness_score;
  const status = recoveryPresentation(selected.recovery_status);
  const sourceLabel = selected.providers.length
    ? selected.providers.map(titleCaseProvider).join(" + ")
    : connectedProviders.map((connection) => titleCaseProvider(connection.provider)).join(" + ");
  const dateLabel = formatSummaryDate(selected.summary_date);
  const isToday = selected.summary_date === dateKeyInTimeZone(new Date(), "Europe/London");

  return (
    <div className="mx-auto w-full max-w-6xl pb-28 sm:pb-8">
      <HealthHeader
        connectedProviders={connectedProviders}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onManageConnections={onManageConnections}
      />

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="View an older day"
          disabled={selectedIndex >= orderedSummaries.length - 1}
          onClick={() => setSelectedIndex((index) => Math.min(orderedSummaries.length - 1, index + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 transition disabled:opacity-25"
        >
          <Chevron direction="left" />
        </button>
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            {isToday ? "Today" : "Daily health"}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white/85">{dateLabel}</div>
        </div>
        <button
          type="button"
          aria-label="View a newer day"
          disabled={selectedIndex === 0}
          onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 transition disabled:opacity-25"
        >
          <Chevron direction="right" />
        </button>
      </div>

      <nav aria-label="Health signal categories" className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1.5 sm:min-w-0 sm:grid sm:grid-cols-5 sm:gap-2">
          {categories.map((item) => {
            const active = category === item;
            const categoryCopy = CATEGORY_COPY[item];
            const categoryValue = categoryReading(item, selected);
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={active}
                className={`group relative flex min-w-[82px] flex-col items-center rounded-[22px] px-2 pb-3 pt-2 text-center transition sm:min-w-0 ${
                  active
                    ? "bg-white/[0.075] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                    : "text-white/42 hover:bg-white/[0.035] hover:text-white/70"
                }`}
              >
                <span className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full border transition ${active ? "border-[#ef68db]/55 bg-[#ef68db]/[0.09] shadow-[0_0_28px_-10px_rgba(239,104,219,0.8)]" : "border-white/[0.09] bg-white/[0.025]"}`}>
                  <SignalIcon name={categoryCopy.icon} className={`absolute left-1/2 top-1.5 h-3.5 w-3.5 -translate-x-1/2 ${active ? "text-[#ef68db]" : "text-white/35"}`} />
                  <span className={`metric-num mt-3 text-[1.15rem] font-semibold leading-none ${active ? "text-white" : "text-white/62"}`}>
                    {categoryValue}
                  </span>
                </span>
                <span className={`mt-2 text-[11px] font-semibold ${active ? "text-white" : "text-white/42"}`}>{categoryCopy.label}</span>
                <span className={`absolute inset-x-5 bottom-0 h-px origin-center bg-[#ef68db] transition-transform ${active ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            );
          })}
        </div>
      </nav>

      <section className="relative mt-4 overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#121116] shadow-[0_34px_90px_-52px_rgba(224,64,208,0.52)]">
        <CapacityTrendBackdrop summaries={orderedSummaries} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(224,64,208,0.09),transparent_38%),linear-gradient(180deg,transparent_46%,rgba(9,8,11,0.78)_82%)]" />
        <div className="absolute left-5 top-5 z-10 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38 sm:left-7 sm:top-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[#58d6b0] shadow-[0_0_12px_rgba(88,214,176,0.75)]" />
          Today&apos;s coaching signal
        </div>
        <div className="absolute right-5 top-5 z-10 text-right sm:right-7 sm:top-6">
          <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/28">7 day average</div>
          <div className="metric-num mt-0.5 text-lg font-semibold leading-none text-white/68">{readinessAverage(orderedSummaries)}</div>
        </div>
        <div className="relative grid items-center gap-5 px-5 pb-6 pt-16 sm:grid-cols-[240px_1fr] sm:gap-8 sm:px-9 sm:pb-9 sm:pt-16">
          <CapacityRing score={score} status={status.shortLabel} />
          <div className="text-center sm:text-left">
            <div className={`text-[11px] font-bold uppercase tracking-[0.2em] ${status.tone}`}>{status.label}</div>
            <h2 className="mt-2 font-heading text-[2.35rem] font-bold leading-[0.98] tracking-[-0.025em] text-white sm:text-[3rem]">
              {status.headline}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-[1.65] text-white/58 sm:mx-0 sm:text-[15px]">
              {selected.insight || status.fallbackInsight}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <Link
                href="/portal/exercise-plan"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7f4f7] px-5 text-sm font-bold text-[#171419] no-underline transition hover:bg-[#ffffff]"
              >
                View today&apos;s training
              </Link>
              {sourceLabel && (
                <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-4 text-xs font-semibold text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#58d6b0]" />
                  Today&apos;s {sourceLabel} signals
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-9 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ef68db]">
            {CATEGORY_COPY[category].label}
          </div>
          <h2 className="mt-1 font-heading text-[1.6rem] font-bold leading-none tracking-tight text-white">{CATEGORY_COPY[category].heading}</h2>
        </div>
        <div className="hidden text-xs text-white/35 sm:block">Compared with the latest seven synced days</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {visibleMetrics.map((metric) => (
          <SignalMetricCard
            key={metric.key}
            metric={metric}
            summary={selected}
            summaries={orderedSummaries}
            connectedProviders={connectedProviders}
          />
        ))}
      </div>

      <section className="mt-4 flex flex-col gap-4 rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e440d0]/12 text-[#ef68db]">
              <SignalIcon name="spark" className="h-4 w-4" />
            </span>
            Your data stays coaching-led
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/48">
            This daily score uses sleep, recovery and training signals. Nutrition progress is shown separately and never lowers a live recovery score.
          </p>
        </div>
        <button
          type="button"
          onClick={onManageConnections}
          className="min-h-11 shrink-0 rounded-full border border-white/12 px-5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.05]"
        >
          Manage connections
        </button>
      </section>
    </div>
  );
}

function HealthHeader({
  connectedProviders,
  refreshing,
  onRefresh,
  onManageConnections,
}: {
  connectedProviders: WearableConnection[];
  refreshing: boolean;
  onRefresh: () => void;
  onManageConnections: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ef68db]">Connected health</div>
        <h1 className="mt-1 truncate font-heading text-[2.05rem] font-bold leading-none tracking-[-0.02em] text-white sm:text-[2.6rem]">
          Health &amp; Capacity
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh health data"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] disabled:opacity-50"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
        <button
          type="button"
          onClick={onManageConnections}
          aria-label="Manage health data connections"
          className="relative flex h-11 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07]"
        >
          <span className={`h-2 w-2 rounded-full ${connectedProviders.length ? "bg-[#58d6b0]" : "bg-white/25"}`} />
          <span className="hidden sm:inline">Connections</span>
          <SignalIcon name="settings" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function CapacityRing({
  score,
  status,
}: {
  score: number | null;
  status: string;
}) {
  const safeScore = score === null ? 0 : Math.max(0, Math.min(100, score));
  const ringColor = safeScore < 55 ? "#f18b71" : safeScore < 72 ? "#f2b968" : "#ef68db";
  return (
    <div className="mx-auto flex flex-col items-center">
      <div
        className="relative flex h-[168px] w-[168px] items-center justify-center rounded-full p-[9px] shadow-[0_20px_60px_-28px_rgba(224,64,208,0.72)] sm:h-[206px] sm:w-[206px] sm:p-[10px]"
        style={{
          background: `conic-gradient(${ringColor} ${safeScore * 3.6}deg, rgba(255,255,255,0.085) ${safeScore * 3.6}deg 360deg)`,
        }}
        role="img"
        aria-label={score === null ? "Capacity score unavailable" : `Capacity score ${score} out of 100`}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/[0.07] bg-[#0f0e12]/95 shadow-[inset_0_0_42px_rgba(255,255,255,0.022)] backdrop-blur-sm">
          <div className="text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40">Capacity</div>
          <div className="mt-1 font-heading text-[4.15rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[4.8rem]">{score ?? "—"}</div>
          <div className="mt-1 text-xs font-semibold text-white/42">{score === null ? "Collecting data" : status}</div>
        </div>
      </div>
    </div>
  );
}

function SignalMetricCard({
  metric,
  summary,
  summaries,
  connectedProviders,
}: {
  metric: MetricDefinition;
  summary: WearableDailySummary;
  summaries: WearableDailySummary[];
  connectedProviders: WearableConnection[];
}) {
  const value = metricValue(summary, metric.key);
  const series = summaries
    .slice(0, 7)
    .reverse()
    .map((item) => metricValue(item, metric.key));
  const availableValues = series.filter((item): item is number => item !== null);
  const average = availableValues.length
    ? availableValues.reduce((total, item) => total + item, 0) / availableValues.length
    : null;
  const source = expectedSource(metric.category, summary.providers, connectedProviders);
  const accent = ACCENTS[metric.accent];
  const comparison = value !== null && average !== null
    ? comparisonLabel(value, average, metric)
    : source
      ? `Waiting for ${source}`
      : "Connect a compatible app";

  return (
    <article className="group relative min-h-[178px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#17161b] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_45px_-34px_rgba(0,0,0,0.9)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] sm:min-h-[194px] sm:p-5">
      <div className={`pointer-events-none absolute inset-0 opacity-90 ${accent.glow}`} />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-white/55">{metric.label}</div>
            <div className={`mt-1 text-[11px] font-medium ${value === null ? "text-white/30" : accent.text}`}>{comparison}</div>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-black/15">
            <SignalIcon name={CATEGORY_COPY[metric.category].icon} className={`h-4 w-4 ${accent.text}`} />
          </span>
        </div>
        <div className="mt-auto">
          <div className="metric-num text-[2rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[2.4rem]">
            {value === null ? "No data" : metric.format(value)}
          </div>
          <MiniTrend values={series} color={accent.line} id={metric.key} />
          <div className="mt-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.13em] text-white/24">
            <span>7 day trend</span>
            <span>{source || "Manual"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniTrend({ values, color, id }: { values: Array<number | null>; color: string; id: string }) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null);
  if (points.length < 2) {
    return <div className="mt-4 h-8 border-b border-dashed border-white/[0.08]" aria-hidden="true" />;
  }
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = Math.max(max - min, 1);
  const denominator = Math.max(values.length - 1, 1);
  const plotted = points
    .map((point) => `${(point.index / denominator) * 100},${34 - ((point.value - min) / range) * 27}`)
    .join(" ");
  return (
    <svg className="mt-3 h-9 w-full overflow-visible" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,38 ${plotted} 100,38`} fill={`url(#trend-${id})`} />
      <line x1="0" y1="35" x2="100" y2="35" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <polyline
        points={plotted}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={(points.at(-1)!.index / denominator) * 100}
        cy={34 - ((points.at(-1)!.value - min) / range) * 27}
        r="2"
        fill={color}
      />
    </svg>
  );
}

function CapacityTrendBackdrop({ summaries }: { summaries: WearableDailySummary[] }) {
  const values = summaries
    .slice(0, 7)
    .reverse()
    .map((summary) => summary.readiness_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 8);
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${76 - ((value - min) / range) * 42}`)
    .join(" ");
  const lastPoint = points.split(" ").at(-1)?.split(",") || ["100", "48"];
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-7 h-[58%] w-full opacity-55"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="capacity-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef68db" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ef68db" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="capacity-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef68db" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ef68db" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill="url(#capacity-area)" />
      <polyline
        points={points}
        fill="none"
        stroke="url(#capacity-line)"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="1.25" fill="#ef68db" />
    </svg>
  );
}

function HealthOverviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse pb-28 sm:pb-8">
      <div className="flex items-center justify-between">
        <div className="h-10 w-52 rounded-2xl bg-white/[0.06]" />
        <div className="h-11 w-24 rounded-full bg-white/[0.06]" />
      </div>
      <div className="mt-20 h-[330px] rounded-[32px] bg-white/[0.045]" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-44 rounded-[24px] bg-white/[0.04]" />)}
      </div>
    </div>
  );
}

function recoveryPresentation(status: WearableDailySummary["recovery_status"]) {
  if (status === "reduce_intensity") {
    return {
      label: "Recovery under pressure",
      shortLabel: "Take care",
      headline: "Keep today controlled",
      tone: "text-[#f18b71]",
      fallbackInsight: "Recovery signals are lower today. Keep the session technical and leave a little more in reserve.",
    };
  }
  if (status === "watch") {
    return {
      label: "Some signals to watch",
      shortLabel: "Be measured",
      headline: "Train, but stay responsive",
      tone: "text-[#f2b968]",
      fallbackInsight: "You are still in a position to train. Pay attention to effort and make the quality of each rep the priority.",
    };
  }
  return {
    label: "Recovery looks steady",
    shortLabel: "Good to train",
    headline: "You have room to perform",
    tone: "text-[#58d6b0]",
    fallbackInsight: "Your connected signals look steady. There is no recovery reason to change today’s plan.",
  };
}

function metricValue(summary: WearableDailySummary, key: MetricKey) {
  const value = summary[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function categoryReading(category: SignalCategory, summary: WearableDailySummary) {
  if (category === "overview") return summary.readiness_score === null ? "—" : Math.round(summary.readiness_score);
  if (category === "sleep") {
    if (summary.sleep_score !== null) return Math.round(summary.sleep_score);
    return summary.sleep_minutes === null ? "—" : `${(summary.sleep_minutes / 60).toFixed(1)}h`;
  }
  if (category === "activity") {
    if (summary.steps === null) return "—";
    return summary.steps >= 1000 ? `${(summary.steps / 1000).toFixed(1)}k` : Math.round(summary.steps);
  }
  if (category === "heart") return summary.hrv_ms === null ? "—" : `${Math.round(summary.hrv_ms)}ms`;
  return summary.protein_g === null ? "—" : `${Math.round(summary.protein_g)}g`;
}

function readinessAverage(summaries: WearableDailySummary[]) {
  const values = summaries
    .slice(0, 7)
    .map((summary) => summary.readiness_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return "—";
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function comparisonLabel(value: number, average: number, metric: MetricDefinition) {
  if (average === 0) return "Latest synced value";
  const difference = Math.round(((value - average) / average) * 100);
  if (Math.abs(difference) < 2) return "In line with your 7-day average";
  if (metric.key === "resting_hr_bpm") {
    return `${Math.abs(difference)}% ${difference < 0 ? "below" : "above"} your average`;
  }
  return `${Math.abs(difference)}% ${difference > 0 ? "above" : "below"} your average`;
}

function expectedSource(
  category: Exclude<SignalCategory, "overview">,
  summaryProviders: string[],
  connections: WearableConnection[],
) {
  const providers = summaryProviders.length
    ? summaryProviders
    : connections.filter((connection) => connection.status === "connected").map((connection) => connection.provider);
  if (category === "nutrition") {
    return providers.includes("myfitnesspal") ? "MyFitnessPal" : null;
  }
  const provider = providers.find((item) => item !== "myfitnesspal");
  return provider ? titleCaseProvider(provider) : null;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatSummaryDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignalIcon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    spark: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    moon: "M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z",
    bolt: "m13 2-8 12h7l-1 8 8-12h-7l1-8Z",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.6a5.5 5.5 0 0 0 1.1-8.8Z",
    drop: "M12 2.7S5.8 9.4 5.8 14a6.2 6.2 0 0 0 12.4 0C18.2 9.4 12 2.7 12 2.7Z",
    settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-3.2a7.8 7.8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3.4h-4L10.6 6a8 8 0 0 0-1.7 1L6.5 6l-2 3.5 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7.8 7.8 0 0 0 .1-1Z",
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true">
      <path d={paths[name] || paths.spark} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
