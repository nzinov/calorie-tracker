import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

// UserFood represents a food in user's database
interface UserFood {
  id: string
  name: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  saltPer100g: number
  defaultGrams: number | null
  comments: string | null
}

// FoodEntry is a daily log entry referencing a UserFood
interface FoodEntry {
  id: string
  userFoodId: string
  grams: number
  date: string
  timestamp: Date
  userFood: UserFood
}

interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
}

interface DailyLogData {
  date: string
  foodEntries: FoodEntry[]
  totals: NutritionTotals
}

export function useDailyLog(date: string) {
  const { status } = useSession()
  const [data, setData] = useState<DailyLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to calculate nutrition from entry
  function calculateEntryNutrition(entry: FoodEntry) {
    const ratio = entry.grams / 100
    return {
      calories: entry.userFood.caloriesPer100g * ratio,
      protein: entry.userFood.proteinPer100g * ratio,
      carbs: entry.userFood.carbsPer100g * ratio,
      fat: entry.userFood.fatPer100g * ratio,
      fiber: entry.userFood.fiberPer100g * ratio,
      salt: entry.userFood.saltPer100g * ratio
    }
  }

  // Calculate totals from food entries
  function calculateTotals(entries: FoodEntry[]): NutritionTotals {
    return entries.reduce((totals, entry) => {
      const nutrition = calculateEntryNutrition(entry)
      return {
        calories: totals.calories + nutrition.calories,
        protein: totals.protein + nutrition.protein,
        carbs: totals.carbs + nutrition.carbs,
        fat: totals.fat + nutrition.fat,
        fiber: totals.fiber + nutrition.fiber,
        salt: totals.salt + nutrition.salt,
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 })
  }

  const fetchData = useCallback(async () => {
    // In development, always proceed. In production, wait until authenticated
    if (process.env.NODE_ENV === 'production' && status !== 'authenticated') {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = `?date=${date}`
      const response = await fetch(`/api/daily-logs${params}`)

      if (!response.ok) {
        throw new Error("Failed to fetch daily log")
      }

      const result = await response.json()

      // Convert timestamp strings to Date objects
      result.foodEntries = result.foodEntries.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }))

      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [status, date])

  useEffect(() => {
    // Clear data when date changes to avoid working with stale data
    if (data) {
      setData(null);
    }
    fetchData();
  }, [fetchData, date])

  const addFoodEntry = async (entry: { userFoodId: string; grams: number }) => {
    try {
      const response = await fetch("/api/food-entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...entry, date }),
      })

      if (!response.ok) {
        throw new Error("Failed to add food entry")
      }

      const newEntry = await response.json()

      // Optimistic update - add the new entry to existing data
      setData(prev => {
        if (!prev) return null

        const newFoodEntry = {
          ...newEntry,
          timestamp: new Date(newEntry.timestamp)
        }

        const updatedEntries = [...prev.foodEntries, newFoodEntry]
        const newTotals = calculateTotals(updatedEntries)

        return {
          ...prev,
          foodEntries: updatedEntries,
          totals: newTotals
        }
      })

      return newEntry
    } catch (err) {
      throw err
    }
  }

  const updateFoodEntry = async (id: string, updates: {
    grams?: number
    caloriesPer100g?: number
    proteinPer100g?: number
    carbsPer100g?: number
    fatPer100g?: number
    fiberPer100g?: number
    saltPer100g?: number
  }) => {
    try {
      const response = await fetch(`/api/food-entries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error("Failed to update food entry")
      }

      const updatedEntry = await response.json()

      // Optimistic update - update the entry in existing data
      setData(prev => {
        if (!prev) return null

        const updatedEntries = prev.foodEntries.map(existingEntry =>
          existingEntry.id === id
            ? { ...updatedEntry, timestamp: new Date(updatedEntry.timestamp) }
            : existingEntry
        )

        const newTotals = calculateTotals(updatedEntries)

        return {
          ...prev,
          foodEntries: updatedEntries,
          totals: newTotals
        }
      })
    } catch (err) {
      throw err
    }
  }

  const deleteFoodEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/food-entries/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete food entry")
      }

      // Optimistic update - remove the entry from existing data
      setData(prev => {
        if (!prev) return null

        const updatedEntries = prev.foodEntries.filter(entry => entry.id !== id)
        const newTotals = calculateTotals(updatedEntries)

        return {
          ...prev,
          foodEntries: updatedEntries,
          totals: newTotals
        }
      })
    } catch (err) {
      throw err
    }
  }

  // Apply server-sent data change hints without refetching
  const applyDataUpdate = (update: { foodAdded?: any; foodUpdated?: any; foodDeleted?: string }) => {
    setData(prev => {
      if (!prev) return prev

      let updatedEntries = prev.foodEntries

      if (update.foodAdded) {
        const entry = update.foodAdded
        const newEntry = {
          ...entry,
          timestamp: new Date(entry.timestamp)
        }
        updatedEntries = [...updatedEntries, newEntry]
      } else if (update.foodUpdated) {
        const entry = update.foodUpdated
        const updated = {
          ...entry,
          timestamp: new Date(entry.timestamp)
        }
        updatedEntries = updatedEntries.map(e => e.id === updated.id ? updated : e)
      } else if (update.foodDeleted) {
        const id = update.foodDeleted
        updatedEntries = updatedEntries.filter(e => e.id !== id)
      } else {
        return prev
      }

      const newTotals = calculateTotals(updatedEntries)

      return {
        ...prev,
        foodEntries: updatedEntries,
        totals: newTotals
      }
    })
  }


  return {
    data,
    loading,
    error,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    applyDataUpdate,
    refetch: fetchData,
  }
}
