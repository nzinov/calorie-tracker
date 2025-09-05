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
}

export function NutritionDashboard({ data }: NutritionDashboardProps) {
  const { targets } = useUserSettings()
  const t = targets || DAILY_TARGETS
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
