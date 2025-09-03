"use client"

import { ProgressBar } from "./progress-bar"
import { DAILY_TARGETS } from "@/lib/constants"

interface NutritionData {
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
}

interface NutritionDashboardProps {
  data: NutritionData
}

export function NutritionDashboard({ data }: NutritionDashboardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-3 md:p-4 h-full">
      <div className="flex flex-col gap-1.5">
        <ProgressBar
          label="Calories"
          current={data.calories}
          target={DAILY_TARGETS.calories}
          unit="kcal"
          color="bg-orange-500"
        />
        
        <ProgressBar
          label="Protein"
          current={data.protein}
          target={DAILY_TARGETS.protein}
          unit="g"
          color="bg-red-500"
        />
        
        <ProgressBar
          label="Carbohydrates"
          current={data.carbs}
          target={DAILY_TARGETS.carbs}
          unit="g"
          color="bg-yellow-500"
        />
        
        <ProgressBar
          label="Fat"
          current={data.fat}
          target={DAILY_TARGETS.fat}
          unit="g"
          color="bg-purple-500"
        />
        
        <ProgressBar
          label="Fiber"
          current={data.fiber}
          target={DAILY_TARGETS.fiber}
          unit="g"
          color="bg-green-500"
        />
      </div>
    </div>
  )
}
