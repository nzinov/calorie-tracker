"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { DAILY_TARGETS } from "@/lib/constants"

export type Targets = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
}

type Ctx = {
  targets: Targets
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  saveTargets: (t: Partial<Targets>) => Promise<void>
}

const defaultTargets: Targets = { ...DAILY_TARGETS }

const UserSettingsContext = createContext<Ctx | undefined>(undefined)

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [targets, setTargets] = useState<Targets>(defaultTargets)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/user/settings")
      if (!res.ok) throw new Error("Failed to load settings")
      const data = await res.json()
      setTargets(data.targets as Targets)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const saveTargets = useCallback(async (t: Partial<Targets>) => {
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t),
    })
    if (!res.ok) throw new Error("Failed to save settings")
    // Merge immediately for responsive UI
    setTargets(prev => ({ ...prev, ...t }))
  }, [])

  const value: Ctx = { targets, loading, error, refetch, saveTargets }
  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext)
  if (!ctx) throw new Error("useUserSettings must be used within UserSettingsProvider")
  return ctx
}
