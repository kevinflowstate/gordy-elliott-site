"use client";

interface MacroSummaryBarProps {
  actual: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  target?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

export default function MacroSummaryBar({ actual, target }: MacroSummaryBarProps) {
  const items = [
    { label: "Calories", value: Math.round(actual.calories), target: target?.calories, unit: "kcal", color: "text-text-primary" },
    { label: "Protein", value: Math.round(actual.protein_g), target: target?.protein_g, unit: "g", color: "text-blue-500" },
    { label: "Carbs", value: Math.round(actual.carbs_g), target: target?.carbs_g, unit: "g", color: "text-accent-bright" },
    { label: "Fat", value: Math.round(actual.fat_g), target: target?.fat_g, unit: "g", color: "text-red-500" },
  ];

  return (
    <div className="flex gap-4 p-3 rounded-xl bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] border border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]">
      {items.map((item) => (
        <div key={item.label} className="flex-1 text-center">
          <p className="text-[13px] text-text-secondary mb-0.5">{item.label}</p>
          <p className={`text-lg font-bold ${item.color}`}>
            {item.value}
            <span className="text-[13px] font-normal text-text-secondary/60">{item.unit}</span>
          </p>
          {item.target && (
            <p className="text-[13px] text-text-secondary/50">/ {item.target}{item.unit}</p>
          )}
        </div>
      ))}
    </div>
  );
}
