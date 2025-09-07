import { useState, useEffect, useCallback } from "react"
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

export function useDailyLog(date: string) {
  const { data: session } = useSession()
  const [data, setData] = useState<DailyLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    // In development, always proceed. In production, wait for session
    if (process.env.NODE_ENV === 'production' && !session) {
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
  }, [session, date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

      const newEntry = await response.json()
      
      // Optimistic update - add the new entry to existing data
      setData(prev => {
        if (!prev) return null
        
        const newFoodEntry = {
          ...newEntry,
          timestamp: new Date(newEntry.timestamp)
        }
        
        const updatedEntries = [...prev.dailyLog.foodEntries, newFoodEntry]
        
        // Recalculate totals
        const newTotals = updatedEntries.reduce((totals, entry) => ({
          calories: totals.calories + entry.calories,
          protein: totals.protein + entry.protein,
          carbs: totals.carbs + entry.carbs,
          fat: totals.fat + entry.fat,
          fiber: totals.fiber + entry.fiber,
          salt: totals.salt + entry.salt,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 })
        
        return {
          ...prev,
          dailyLog: {
            ...prev.dailyLog,
            foodEntries: updatedEntries
          },
          totals: newTotals
        }
      })
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

      const updatedEntry = await response.json()
      
      // Optimistic update - update the entry in existing data
      setData(prev => {
        if (!prev) return null
        
        const updatedEntries = prev.dailyLog.foodEntries.map(existingEntry => 
          existingEntry.id === id 
            ? { ...updatedEntry, timestamp: new Date(updatedEntry.timestamp) }
            : existingEntry
        )
        
        // Recalculate totals
        const newTotals = updatedEntries.reduce((totals, entry) => ({
          calories: totals.calories + entry.calories,
          protein: totals.protein + entry.protein,
          carbs: totals.carbs + entry.carbs,
          fat: totals.fat + entry.fat,
          fiber: totals.fiber + entry.fiber,
          salt: totals.salt + entry.salt,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 })
        
        return {
          ...prev,
          dailyLog: {
            ...prev.dailyLog,
            foodEntries: updatedEntries
          },
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
        
        const updatedEntries = prev.dailyLog.foodEntries.filter(entry => entry.id !== id)
        
        // Recalculate totals
        const newTotals = updatedEntries.reduce((totals, entry) => ({
          calories: totals.calories + entry.calories,
          protein: totals.protein + entry.protein,
          carbs: totals.carbs + entry.carbs,
          fat: totals.fat + entry.fat,
          fiber: totals.fiber + entry.fiber,
          salt: totals.salt + entry.salt,
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 })
        
        return {
          ...prev,
          dailyLog: {
            ...prev.dailyLog,
            foodEntries: updatedEntries
          },
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

      let updatedEntries = prev.dailyLog.foodEntries

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

      const newTotals = updatedEntries.reduce((totals, entry) => ({
        calories: totals.calories + entry.calories,
        protein: totals.protein + entry.protein,
        carbs: totals.carbs + entry.carbs,
        fat: totals.fat + entry.fat,
        fiber: totals.fiber + entry.fiber,
        salt: totals.salt + entry.salt,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 })

      return {
        ...prev,
        dailyLog: {
          ...prev.dailyLog,
          foodEntries: updatedEntries
        },
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
