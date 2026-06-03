"use client";

interface MacroDonutChartProps {
  targetCalories: number;
  consumedCalories: number;
  protein: { target: number; consumed: number };
  carbs: { target: number; consumed: number };
  fat: { target: number; consumed: number };
}

const COLORS = {
  protein: "#3B82F6",  // blue
  carbs: "#E040D0",    // hot pink
  fat: "#EF4444",      // red
  remaining: "rgba(0,0,0,0.06)",
  remainingDark: "rgba(255,255,255,0.06)",
};

export default function MacroDonutChart({
  targetCalories,
  consumedCalories,
  protein,
  carbs,
  fat,
}: MacroDonutChartProps) {
  const calPercent = targetCalories > 0 ? Math.min((consumedCalories / targetCalories) * 100, 100) : 0;

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="relative w-64 h-64 mx-auto">
        <div
          className="absolute inset-0 rounded-full p-[14px]"
          style={{
            background: calPercent > 0
              ? `conic-gradient(${COLORS.carbs} 0 ${calPercent}%, ${COLORS.remaining} ${calPercent}% 100%)`
              : COLORS.remaining,
          }}
          aria-hidden="true"
        >
          <div className="h-full w-full rounded-full bg-bg-card p-[18px] shadow-inner">
            <div className="flex h-full w-full items-center justify-center rounded-full border border-[rgba(0,0,0,0.06)] bg-bg-primary" />
          </div>
        </div>

        {calPercent === 0 && (
          <div className="absolute left-1/2 top-8 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bg-card/90 px-2 py-1 shadow-sm" aria-hidden="true">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.protein }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.carbs }} />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.fat }} />
          </div>
        )}

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-text-primary">
            {Math.round(calPercent)}%
          </span>
          <span className="text-[13px] text-text-secondary">
            {consumedCalories.toLocaleString()} / {targetCalories.toLocaleString()}
          </span>
          <span className="text-[13px] text-text-secondary/70">kcal</span>
          {calPercent === 0 && (
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">No totals yet</span>
          )}
        </div>
      </div>

      {/* Macro bars */}
      <div className="mt-6 space-y-3 max-w-xs mx-auto">
        {/* Protein */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.protein }} />
              <span className="text-[13px] font-medium text-text-primary">Protein</span>
            </div>
            <span className="text-[13px] text-text-secondary font-medium">
              {Math.round(protein.consumed)}g / {Math.round(protein.target)}g
            </span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((protein.consumed / Math.max(protein.target, 1)) * 100, 100)}%`,
                backgroundColor: COLORS.protein,
              }}
            />
          </div>
        </div>

        {/* Carbs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.carbs }} />
              <span className="text-[13px] font-medium text-text-primary">Carbs</span>
            </div>
            <span className="text-[13px] text-text-secondary font-medium">
              {Math.round(carbs.consumed)}g / {Math.round(carbs.target)}g
            </span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((carbs.consumed / Math.max(carbs.target, 1)) * 100, 100)}%`,
                backgroundColor: COLORS.carbs,
              }}
            />
          </div>
        </div>

        {/* Fat */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.fat }} />
              <span className="text-[13px] font-medium text-text-primary">Fat</span>
            </div>
            <span className="text-[13px] text-text-secondary font-medium">
              {Math.round(fat.consumed)}g / {Math.round(fat.target)}g
            </span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((fat.consumed / Math.max(fat.target, 1)) * 100, 100)}%`,
                backgroundColor: COLORS.fat,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
