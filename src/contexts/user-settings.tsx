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

export type UserFood = {
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

type Ctx = {
  targets: Targets
  userFoods: UserFood[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  saveTargets: (t: Partial<Targets>) => Promise<void>
  fetchUserFoods: () => Promise<void>
  createUserFood: (food: Omit<UserFood, 'id'>) => Promise<UserFood>
  updateUserFood: (id: string, food: Partial<UserFood>) => Promise<UserFood>
  deleteUserFood: (id: string) => Promise<void>
}

const defaultTargets: Targets = { ...DAILY_TARGETS }

const UserSettingsContext = createContext<Ctx | undefined>(undefined)

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [targets, setTargets] = useState<Targets>(defaultTargets)
  const [userFoods, setUserFoods] = useState<UserFood[]>([])
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

  const fetchUserFoods = useCallback(async () => {
    try {
      const res = await fetch("/api/user-foods")
      if (!res.ok) throw new Error("Failed to load food database")
      const data = await res.json()
      setUserFoods(data.items as UserFood[])
    } catch (e: any) {
      console.error("Failed to fetch food database:", e)
    }
  }, [])

  const createUserFood = useCallback(async (food: Omit<UserFood, 'id'>) => {
    const res = await fetch("/api/user-foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(food),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || "Failed to create food")
    }
    const newFood = await res.json()
    setUserFoods(prev => [newFood, ...prev])
    return newFood
  }, [])

  const updateUserFood = useCallback(async (id: string, food: Partial<UserFood>) => {
    const res = await fetch(`/api/user-foods/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(food),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || "Failed to update food")
    }
    const updatedFood = await res.json()
    setUserFoods(prev => prev.map(f => f.id === id ? updatedFood : f))
    return updatedFood
  }, [])

  const deleteUserFood = useCallback(async (id: string) => {
    const res = await fetch(`/api/user-foods/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || "Failed to delete food")
    }
    setUserFoods(prev => prev.filter(f => f.id !== id))
  }, [])

  useEffect(() => {
    refetch()
    fetchUserFoods()
  }, [refetch, fetchUserFoods])

  const value: Ctx = {
    targets,
    userFoods,
    loading,
    error,
    refetch,
    saveTargets,
    fetchUserFoods,
    createUserFood,
    updateUserFood,
    deleteUserFood
  }
  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext)
  if (!ctx) throw new Error("useUserSettings must be used within UserSettingsProvider")
  return ctx
}
