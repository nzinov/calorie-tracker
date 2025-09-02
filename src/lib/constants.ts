export const DAILY_TARGETS = {
  calories: 2000,
  protein: 156,
  fat: 78,
  carbs: 165,
  fiber: 37,
  water: 8, // glasses
} as const

export type NutritionType = keyof typeof DAILY_TARGETS
