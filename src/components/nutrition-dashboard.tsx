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
    return (
      <div className="bg-white rounded-lg shadow-md p-3 h-full">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <ProgressBar label="Calories" current={data.calories} target={t.calories} unit="kcal" color="bg-orange-500" compact />
          <ProgressBar label="Protein" current={data.protein} target={t.protein} unit="g" color="bg-red-500" compact />
          <ProgressBar label="Carbs" current={data.carbs} target={t.carbs} unit="g" color="bg-yellow-500" compact />
          <ProgressBar label="Fat" current={data.fat} target={t.fat} unit="g" color="bg-purple-500" compact />
          <ProgressBar label="Fiber" current={data.fiber} target={t.fiber} unit="g" color="bg-green-500" compact />
          <ProgressBar label="Salt" current={data.salt} target={t.salt} unit="g" color="bg-blue-500" compact />
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
