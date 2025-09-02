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
  timestamp: Date
}

interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
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
    try {
      const response = await fetch(`/api/food-entries/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete food entry")
      }

      await fetchData() // Refresh data
    } catch (err) {
      throw err
    }
  }

  return {
    data,
    loading,
    error,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    refetch: fetchData,
  }
}
