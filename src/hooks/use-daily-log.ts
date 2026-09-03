import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useDayEvent } from "@/contexts/day-events"
import {
  calculateTotals,
  emptyTotals,
  type NutritionTotals,
} from "@/lib/nutrition"

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
  vegetablesPer100g: number
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

interface DailyLogData {
  date: string
  foodEntries: FoodEntry[]
  totals: NutritionTotals
}

// Sort entries by timestamp so ordering matches what the server returns
function sortByTimestamp(entries: FoodEntry[]): FoodEntry[] {
  return [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export function useDailyLog(date: string) {
  const { status } = useSession()
  const [data, setData] = useState<DailyLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refetches can overlap, so ignore any response that a newer one superseded.
  const fetchSeqRef = useRef(0)

  const fetchData = useCallback(async () => {
    // In development, always proceed. In production, wait until authenticated
    if (process.env.NODE_ENV === 'production' && status !== 'authenticated') {
      setLoading(false)
      return
    }

    const seq = ++fetchSeqRef.current
    try {
      setLoading(true)
      const response = await fetch(`/api/daily-logs?date=${encodeURIComponent(date)}`)
      if (!response.ok) throw new Error("Failed to fetch daily log")

      const result = await response.json()
      if (seq !== fetchSeqRef.current) return

      setData({
        date: result.date,
        foodEntries: result.foodEntries.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        })),
        // The server computes these with the same code we do; guard only against
        // a malformed response.
        totals: { ...emptyTotals(), ...(result.totals ?? {}) },
      })
      setError(null)
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [status, date])

  useEffect(() => {
    setData(null)
    fetchData()
  }, [fetchData])

  // Any change to this day invalidates the log; refetch the authoritative copy
  // rather than merging a payload into local state.
  useDayEvent('data_changed', evt => {
    if (evt.changed?.day && (evt.targetDate ?? date) === date) fetchData()
  })

  // Show a change immediately, then let the refetch reconcile. Because the server
  // is the source of truth this only has to be close, not exactly right.
  const applyLocal = useCallback((mutate: (entries: FoodEntry[]) => FoodEntry[]) => {
    setData(prev => {
      if (!prev) return prev
      const entries = sortByTimestamp(mutate(prev.foodEntries))
      return { ...prev, foodEntries: entries, totals: calculateTotals(entries) }
    })
  }, [])

  const addFoodEntry = async (entry: { userFoodId: string; grams: number; chatSessionId?: string }) => {
    const response = await fetch("/api/food-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, date }),
    })
    if (!response.ok) throw new Error("Failed to add food entry")

    const newEntry = await response.json()
    applyLocal(entries => entries.some(e => e.id === newEntry.id)
      ? entries
      : [...entries, { ...newEntry, timestamp: new Date(newEntry.timestamp) }])
    await fetchData()
    return newEntry
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
    const response = await fetch(`/api/food-entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error("Failed to update food entry")

    const updated = await response.json()
    applyLocal(entries => entries.map(e =>
      e.id === id ? { ...updated, timestamp: new Date(updated.timestamp) } : e))
    await fetchData()
  }

  const deleteFoodEntry = async (id: string) => {
    const response = await fetch(`/api/food-entries/${id}`, { method: "DELETE" })

    // 404 means the entry is already gone, which is the state we are after.
    // Treating it as a failure used to leave the row on screen with no way to
    // dismiss it, so every retry 404'd again.
    if (!response.ok && response.status !== 404) {
      throw new Error("Failed to delete food entry")
    }

    applyLocal(entries => entries.filter(e => e.id !== id))
    await fetchData()
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
