"use client"

import { ProgressBar } from "./progress-bar"
import { DAILY_TARGETS } from "@/lib/constants"
import { useUserSettings } from "@/contexts/user-settings"

interface NutritionData {
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  salt: number
}

interface NutritionDashboardProps {
  data: NutritionData
  compact?: boolean
}

export function NutritionDashboard({ data, compact = false }: NutritionDashboardProps) {
  const { targets } = useUserSettings()
  const t = targets || DAILY_TARGETS

  if (compact) {
    const nutrients = [
      { label: "Cal", current: data.calories, target: t.calories, unit: "", color: "bg-orange-500", textColor: "text-orange-600" },
      { label: "Pro", current: data.protein, target: t.protein, unit: "g", color: "bg-red-500", textColor: "text-red-600" },
      { label: "Carb", current: data.carbs, target: t.carbs, unit: "g", color: "bg-yellow-500", textColor: "text-yellow-600" },
      { label: "Fat", current: data.fat, target: t.fat, unit: "g", color: "bg-purple-500", textColor: "text-purple-600" },
      { label: "Fib", current: data.fiber, target: t.fiber, unit: "g", color: "bg-green-500", textColor: "text-green-600" },
      { label: "Salt", current: data.salt, target: t.salt, unit: "g", color: "bg-blue-500", textColor: "text-blue-600" },
    ]

    return (
      <div className="bg-white rounded-lg shadow-md p-3 h-full">
        <div className="grid gap-y-1" style={{ gridTemplateColumns: 'auto auto auto 1fr' }}>
          {nutrients.map((n) => {
            const percentage = Math.round((n.current / n.target) * 100)
            const isOver = n.current > n.target
            const remaining = n.target - n.current
            const remainingDisplay = Math.round(Math.abs(remaining))
            return (
              <div key={n.label} className="contents">
                <span className={`text-xs font-semibold ${n.textColor} pr-0.5`}>
                  {n.label}
                </span>
                <span className={`text-[11px] tabular-nums text-right pr-1 ${isOver ? "text-red-600" : "text-green-600"}`}>
                  {isOver ? "+" : ""}{remainingDisplay}{n.unit} {isOver ? "over" : "left"}
                </span>
                <span className="bg-gray-100 text-gray-600 text-[10px] font-semibold py-0.5 px-1 rounded-sm text-center mr-1.5">
                  {percentage}%
                </span>
                <div className="h-1.5 bg-gray-200 rounded-sm overflow-hidden self-center">
                  <div
                    className={`h-full rounded-sm ${isOver ? "bg-red-500" : n.color}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 md:p-4 h-full">
      <div className="flex flex-col gap-1.5">
        <ProgressBar
          label="Calories"
          current={data.calories}
          target={t.calories}
          unit="kcal"
          color="bg-orange-500"
        />

        <ProgressBar
          label="Protein"
          current={data.protein}
          target={t.protein}
          unit="g"
          color="bg-red-500"
        />

        <ProgressBar
          label="Carbohydrates"
          current={data.carbs}
          target={t.carbs}
          unit="g"
          color="bg-yellow-500"
        />

        <ProgressBar
          label="Fat"
          current={data.fat}
          target={t.fat}
          unit="g"
          color="bg-purple-500"
        />

        <ProgressBar
          label="Fiber"
          current={data.fiber}
          target={t.fiber}
          unit="g"
          color="bg-green-500"
        />

        <ProgressBar
          label="Salt"
          current={data.salt}
          target={t.salt}
          unit="g"
          color="bg-blue-500"
        />
      </div>
    </div>
  )
}
