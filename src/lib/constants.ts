export const DAILY_TARGETS = {
  calories: 1900,
  protein: 157,
  fat: 70,
  carbs: 160,
  fiber: 37,
  salt: 5,
  water: 8, // glasses
} as const

export type NutritionType = keyof typeof DAILY_TARGETS
