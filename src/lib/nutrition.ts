// Nutrition math shared by the API and the client.
//
// This used to exist twice - once in the daily-logs route and once in
// use-daily-log - which meant every new nutrient had to be added in both places.
// `vegetables` was added to one before the other. One copy, no drift.

export type NutritionPer100g = {
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  saltPer100g: number
  vegetablesPer100g: number
}

export type NutritionTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
  vegetables: number
}

export type NutritionEntry = {
  grams: number
  userFood: NutritionPer100g
}

export function emptyTotals(): NutritionTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0, vegetables: 0 }
}

export function calculateEntryNutrition(entry: NutritionEntry): NutritionTotals {
  const ratio = entry.grams / 100
  return {
    calories: entry.userFood.caloriesPer100g * ratio,
    protein: entry.userFood.proteinPer100g * ratio,
    carbs: entry.userFood.carbsPer100g * ratio,
    fat: entry.userFood.fatPer100g * ratio,
    fiber: entry.userFood.fiberPer100g * ratio,
    salt: entry.userFood.saltPer100g * ratio,
    vegetables: entry.userFood.vegetablesPer100g * ratio,
  }
}

export function calculateTotals(entries: NutritionEntry[]): NutritionTotals {
  return entries.reduce<NutritionTotals>((totals, entry) => {
    const n = calculateEntryNutrition(entry)
    return {
      calories: totals.calories + n.calories,
      protein: totals.protein + n.protein,
      carbs: totals.carbs + n.carbs,
      fat: totals.fat + n.fat,
      fiber: totals.fiber + n.fiber,
      salt: totals.salt + n.salt,
      vegetables: totals.vegetables + n.vegetables,
    }
  }, emptyTotals())
}
