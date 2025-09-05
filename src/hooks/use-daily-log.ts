import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

interface FoodEntry {
  id: string
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
  timestamp: Date
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
  dailyLog: {
    id: string
    date: string
    foodEntries: FoodEntry[]
  }
  totals: NutritionTotals
}

export function useDailyLog(date?: string) {
  const { data: session } = useSession()
  const [data, setData] = useState<DailyLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    // In development, always proceed. In production, wait for session
    if (process.env.NODE_ENV === 'production' && !session) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = date ? `?date=${date}` : ""
      const response = await fetch(`/api/daily-logs${params}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch daily log")
      }

      const result = await response.json()
      
      // Convert timestamp strings to Date objects
      result.dailyLog.foodEntries = result.dailyLog.foodEntries.map((entry: any) => ({
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
  }

  useEffect(() => {
    fetchData()
  }, [session, date])

  const addFoodEntry = async (entry: Omit<FoodEntry, "id" | "timestamp">) => {
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

      await fetchData() // Refresh data
    } catch (err) {
      throw err
    }
  }

  const updateFoodEntry = async (id: string, entry: Partial<Omit<FoodEntry, "id" | "timestamp">>) => {
    try {
      const response = await fetch(`/api/food-entries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      })

      if (!response.ok) {
        throw new Error("Failed to update food entry")
      }

      await fetchData() // Refresh data
    } catch (err) {
      throw err
    }
  }

  const deleteFoodEntry = async (id: string) => {
    // Optimistic update: remove entry from UI immediately
    if (data) {
      const optimisticData = {
        ...data,
        dailyLog: {
          ...data.dailyLog,
          foodEntries: data.dailyLog.foodEntries.filter(entry => entry.id !== id)
        }
      }
      
      // Recalculate totals
      const remainingEntries = optimisticData.dailyLog.foodEntries
      optimisticData.totals = {
        calories: remainingEntries.reduce((sum, entry) => sum + entry.calories, 0),
        protein: remainingEntries.reduce((sum, entry) => sum + entry.protein, 0),
        carbs: remainingEntries.reduce((sum, entry) => sum + entry.carbs, 0),
        fat: remainingEntries.reduce((sum, entry) => sum + entry.fat, 0),
        fiber: remainingEntries.reduce((sum, entry) => sum + entry.fiber, 0),
        salt: remainingEntries.reduce((sum, entry) => sum + entry.salt, 0)
      }
      
      setData(optimisticData)
    }

    try {
      const response = await fetch(`/api/food-entries/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        // Revert optimistic update on failure
        await fetchData()
        throw new Error("Failed to delete food entry")
      }
      
      // Success - data is already optimistically updated
    } catch (err) {
      // Revert optimistic update on error
      await fetchData()
      throw err
    }
  }

  // Incremental state updates to avoid full refetches
  type DataUpdate = {
    foodEntries?: FoodEntry[]
    totals?: NutritionTotals
    foodAdded?: FoodEntry
    foodUpdated?: FoodEntry
    foodDeleted?: string
    refetch?: boolean
  }

  const updateData = async (update: DataUpdate) => {
    if (update.refetch) {
      await fetchData()
      return
    }

    setData(prev => {
      if (!prev) return prev

      // Create a working copy
      let next: DailyLogData = {
        dailyLog: {
          ...prev.dailyLog,
          foodEntries: prev.dailyLog.foodEntries,
        },
        totals: { ...prev.totals },
      }

      const recalcTotals = () => {
        const list = next.dailyLog.foodEntries
        next.totals = {
          calories: list.reduce((s, e) => s + e.calories, 0),
          protein: list.reduce((s, e) => s + e.protein, 0),
          carbs: list.reduce((s, e) => s + e.carbs, 0),
          fat: list.reduce((s, e) => s + e.fat, 0),
          fiber: list.reduce((s, e) => s + e.fiber, 0),
          salt: list.reduce((s, e) => s + e.salt, 0),
        }
      }

      // Direct replacements take precedence
      if (update.foodEntries) {
        const mapped = update.foodEntries.map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
        next = {
          ...next,
          dailyLog: { ...next.dailyLog, foodEntries: mapped },
          totals: update.totals ? update.totals : next.totals,
        }
        if (!update.totals) recalcTotals()
        return next
      }

      if (update.foodAdded) {
        const added = { ...update.foodAdded, timestamp: new Date(update.foodAdded.timestamp) }
        next = {
          ...next,
          dailyLog: { ...next.dailyLog, foodEntries: [...next.dailyLog.foodEntries, added] }
        }
        recalcTotals()
        return next
      }

      if (update.foodUpdated) {
        const updated = { ...update.foodUpdated, timestamp: new Date(update.foodUpdated.timestamp) }
        next = {
          ...next,
          dailyLog: {
            ...next.dailyLog,
            foodEntries: next.dailyLog.foodEntries.map(e => (e.id === updated.id ? updated : e))
          }
        }
        recalcTotals()
        return next
      }

      if (update.foodDeleted) {
        next = {
          ...next,
          dailyLog: {
            ...next.dailyLog,
            foodEntries: next.dailyLog.foodEntries.filter(e => e.id !== update.foodDeleted)
          }
        }
        recalcTotals()
        return next
      }

      if (update.totals) {
        next = { ...next, totals: update.totals }
        return next
      }

      return prev
    })
  }

  return {
    data,
    loading,
    error,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    refetch: fetchData,
    updateData,
  }
}
