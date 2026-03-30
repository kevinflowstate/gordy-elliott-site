"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface MacroDonutChartProps {
  targetCalories: number;
  consumedCalories: number;
  protein: { target: number; consumed: number };
  carbs: { target: number; consumed: number };
  fat: { target: number; consumed: number };
}

const COLORS = {
  protein: "#3B82F6",  // blue
  carbs: "#E2B830",    // gold
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

  // Outer ring: calorie progress
  const calorieData = [
    { name: "Consumed", value: consumedCalories },
    { name: "Remaining", value: Math.max(0, targetCalories - consumedCalories) },
  ];

  // Inner ring: macro split (target)
  const totalTargetGrams = protein.target + carbs.target + fat.target;
  const macroData = totalTargetGrams > 0
    ? [
        { name: "Protein", value: protein.target, color: COLORS.protein },
        { name: "Carbs", value: carbs.target, color: COLORS.carbs },
        { name: "Fat", value: fat.target, color: COLORS.fat },
      ]
    : [{ name: "None", value: 1, color: COLORS.remaining }];

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="relative w-64 h-64 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Outer ring: calorie progress */}
            <Pie
              data={calorieData}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={95}
              startAngle={90}
              endAngle={-270}
              paddingAngle={0}
              stroke="none"
            >
              <Cell fill={COLORS.carbs} />
              <Cell className="fill-[rgba(0,0,0,0.06)] dark:fill-[rgba(255,255,255,0.06)]" />
            </Pie>
            {/* Inner ring: macro split */}
            <Pie
              data={macroData}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={88}
              innerRadius={68}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="none"
            >
              {macroData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-text-primary">
            {Math.round(calPercent)}%
          </span>
          <span className="text-[13px] text-text-secondary">
            {consumedCalories.toLocaleString()} / {targetCalories.toLocaleString()}
          </span>
          <span className="text-[13px] text-text-secondary/70">kcal</span>
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
