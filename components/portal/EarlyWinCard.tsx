"use client";

import type { EarlyWinView } from "@/lib/early-win";

function shortDate(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatValue(value: number, unit: string) {
  return `${Math.round(value * 10) / 10} ${unit}`;
}

export default function EarlyWinCard({ view }: { view: EarlyWinView }) {
  const { earlyWin, dayNumber, windowDays, reading, progress } = view;
  if (earlyWin.status !== "active") return null;

  const notStarted = dayNumber <= 0;
  const inWindow = dayNumber >= 1 && dayNumber <= windowDays;
  const dayLabel = notStarted
    ? `Begins ${shortDate(earlyWin.start_date)}`
    : inWindow
      ? `Day ${dayNumber} of ${windowDays}`
      : `${windowDays}-day window complete`;

  const readingState = reading.value === null
    ? {
        headline: "No reading yet",
        detail: `Progress will show here once the first reading lands after ${shortDate(earlyWin.start_date)}.`,
      }
    : reading.stale
      ? {
          headline: `No reading in the last ${reading.daysSince} days`,
          detail: `Last reading ${formatValue(reading.value, earlyWin.unit)} on ${shortDate(reading.date || earlyWin.start_date)}.`,
        }
      : null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#E667D6]/25 bg-[#111114] text-white shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">Fourteen-day early win</div>
            <div className="mt-2 truncate text-xl font-bold">{earlyWin.display_label}</div>
          </div>
          <div className="flex-none text-right text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{dayLabel}</div>
        </div>

        {notStarted ? (
          <p className="mt-3 text-sm text-white/60">
            This focus starts on {shortDate(earlyWin.start_date)}. Nothing is needed from you before then.
          </p>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="min-w-0">
                {readingState ? (
                  <>
                    <div className="text-lg font-bold text-amber-300">{readingState.headline}</div>
                    <p className="mt-1 text-xs leading-5 text-white/55">{readingState.detail}</p>
                  </>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="metric-num text-4xl font-bold">{Math.round((reading.value as number) * 10) / 10}</span>
                    <span className="text-sm text-white/45">{earlyWin.unit}</span>
                    {reading.daysSince !== null && reading.daysSince > 0 && reading.date && (
                      <span className="text-xs text-white/45">from {shortDate(reading.date)}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-none text-right text-xs text-white/55">
                <div>Started at {formatValue(earlyWin.starting_value, earlyWin.unit)}</div>
                <div className="mt-0.5 font-semibold text-white/75">Target {formatValue(earlyWin.target_value, earlyWin.unit)}</div>
              </div>
            </div>

            {progress && progress.progressPercent !== null && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-label={`Progress toward target ${progress.progressPercent} percent`}>
                  <div
                    className="h-full rounded-full bg-[#E667D6] transition-[width] duration-700"
                    style={{ width: `${Math.max(3, progress.progressPercent)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-white/55">
                  {progress.achieved
                    ? "Target reached. Hold it steady - Gordy will confirm the win at the review."
                    : `${progress.progressPercent}% of the way from ${formatValue(earlyWin.starting_value, earlyWin.unit)} to ${formatValue(earlyWin.target_value, earlyWin.unit)}.`}
                </p>
              </div>
            )}

            {!inWindow && (
              <p className="mt-3 text-xs leading-5 text-white/55">
                The fourteen days are in. Gordy is reviewing this with you before it moves to the record.
              </p>
            )}
          </>
        )}

        {earlyWin.coaching_note && (
          <p className="mt-4 border-t border-white/8 pt-3 text-xs leading-5 text-white/65">
            <span className="font-bold uppercase tracking-[0.14em] text-white/40">From Gordy - </span>
            {earlyWin.coaching_note}
          </p>
        )}
      </div>
    </section>
  );
}
