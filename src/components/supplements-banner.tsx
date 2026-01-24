"use client"

import { useState, useEffect } from "react"
import { useUserSettings } from "@/contexts/user-settings"

type Period = "morning" | "evening"

function getPeriod(): Period {
  const hour = new Date().getHours()
  return hour < 18 ? "morning" : "evening"
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function SupplementsBanner() {
  const { featureFlags, supplementsDismissedState, dismissSupplements, loading } = useUserSettings()
  const [period, setPeriod] = useState<Period>(getPeriod)
  const [mounted, setMounted] = useState(false)

  // Mark as mounted after hydration to avoid SSR mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Poll every minute for period changes
  useEffect(() => {
    const interval = setInterval(() => {
      setPeriod(getPeriod())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Don't render during SSR or while loading to avoid hydration mismatch
  if (!mounted || loading) {
    return null
  }

  // Check if feature is enabled
  if (!featureFlags.supplementsReminder) {
    return null
  }

  // Check if already dismissed today
  const today = getTodayDateString()
  const dismissedDate = period === "morning"
    ? supplementsDismissedState.morningDismissedDate
    : supplementsDismissedState.eveningDismissedDate

  if (dismissedDate === today) {
    return null
  }

  const handleDismiss = async () => {
    try {
      await dismissSupplements(period)
    } catch (error) {
      console.error("Failed to dismiss supplements:", error)
    }
  }

  const isMorning = period === "morning"

  return (
    <div className="flex justify-center py-2 bg-gray-50 border-b border-gray-200">
      <label className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full cursor-pointer transition-colors ${
        isMorning
          ? "bg-amber-100 hover:bg-amber-200 border border-amber-300"
          : "bg-indigo-100 hover:bg-indigo-200 border border-indigo-300"
      }`}>
        <input
          type="checkbox"
          onChange={handleDismiss}
          className={`w-4 h-4 rounded ${isMorning ? "text-amber-600 focus:ring-amber-500" : "text-indigo-600 focus:ring-indigo-500"}`}
        />
        <span className={`text-sm font-medium ${isMorning ? "text-amber-800" : "text-indigo-800"}`}>
          {isMorning ? "Morning supplements" : "Evening supplements"}
        </span>
      </label>
    </div>
  )
}
