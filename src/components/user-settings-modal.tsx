"use client"

import React, { useEffect, useState } from "react"
import { useUserSettings } from "@/contexts/user-settings"
import { FoodDatabaseTable, UserFood } from "./food-database-table"
import { FoodEditForm } from "./food-edit-form"

type Props = {
  open: boolean
  onClose: () => void
}

type Tab = "targets" | "foods"

export function UserSettingsModal({ open, onClose }: Props) {
  const { targets, saveTargets, userFoods, loading, fetchUserFoods, deleteUserFood, createUserFood, updateUserFood } = useUserSettings()
  const [activeTab, setActiveTab] = useState<Tab>("targets")
  const [form, setForm] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    salt: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Food database edit state
  const [editingFood, setEditingFood] = useState<UserFood | null>(null)
  const [showFoodForm, setShowFoodForm] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ ...targets })
      setError(null)
      // Reload food database from backend every time settings are opened
      fetchUserFoods()

      // Lock body scroll and compensate for scrollbar
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`

      return () => {
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
    }
  }, [open, targets, fetchUserFoods])

  const update = (key: keyof typeof form, value: string) => {
    const num = Number(value)
    setForm(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveTargets(form)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFood = async (id: string) => {
    try {
      await deleteUserFood(id)
    } catch (e: any) {
      console.error("Failed to delete food", e)
    }
  }

  const handleEditFood = (food: UserFood) => {
    setEditingFood(food)
    setShowFoodForm(true)
  }

  const handleAddFood = () => {
    setEditingFood(null)
    setShowFoodForm(true)
  }

  const handleCancelFoodEdit = () => {
    setShowFoodForm(false)
    setEditingFood(null)
  }

  const handleSaveFood = async (foodData: Partial<UserFood> & { name: string }) => {
    if (editingFood) {
      // Update existing food
      await updateUserFood(editingFood.id, foodData)
    } else {
      // Create new food - all fields are provided with defaults from the modal
      await createUserFood({
        name: foodData.name,
        caloriesPer100g: foodData.caloriesPer100g ?? 0,
        proteinPer100g: foodData.proteinPer100g ?? 0,
        carbsPer100g: foodData.carbsPer100g ?? 0,
        fatPer100g: foodData.fatPer100g ?? 0,
        fiberPer100g: foodData.fiberPer100g ?? 0,
        saltPer100g: foodData.saltPer100g ?? 0,
        defaultGrams: foodData.defaultGrams ?? null,
        comments: foodData.comments ?? null
      })
    }
    setShowFoodForm(false)
    setEditingFood(null)
    await fetchUserFoods()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-3xl rounded-lg shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with Tabs */}
        <div className="flex items-center border-b border-gray-200 px-2">
          <button
            onClick={() => { setActiveTab("targets"); setShowFoodForm(false) }}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "targets"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Targets
          </button>
          <button
            onClick={() => setActiveTab("foods")}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "foods"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Food Database
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "targets" && (
            <div>
              <p className="text-sm text-gray-800 mb-4">Set your daily nutrition targets.</p>

              {loading ? (
                <div className="py-8 text-center text-gray-800">Loading...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <label className="col-span-2 text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Calories (kcal)</span>
                    <input type="number" value={form.calories}
                           onChange={e => update('calories', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Protein (g)</span>
                    <input type="number" value={form.protein}
                           onChange={e => update('protein', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Carbs (g)</span>
                    <input type="number" value={form.carbs}
                           onChange={e => update('carbs', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Fat (g)</span>
                    <input type="number" value={form.fat}
                           onChange={e => update('fat', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Fiber (g)</span>
                    <input type="number" value={form.fiber}
                           onChange={e => update('fiber', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                  <label className="text-sm text-gray-900">
                    <span className="block text-gray-900 mb-1">Salt (g)</span>
                    <input type="number" value={form.salt}
                           onChange={e => update('salt', e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" />
                  </label>
                </div>
              )}

              {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

              <div className="mt-6 flex justify-end gap-2">
                <button className="px-4 py-2 text-gray-800 bg-gray-100 rounded hover:bg-gray-200" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {activeTab === "foods" && !showFoodForm && (
            <FoodDatabaseTable
              items={userFoods}
              onDelete={handleDeleteFood}
              onEdit={handleEditFood}
              onAdd={handleAddFood}
            />
          )}

          {activeTab === "foods" && showFoodForm && (
            <FoodEditForm
              food={editingFood}
              onSave={handleSaveFood}
              onCancel={handleCancelFoodEdit}
            />
          )}
        </div>
      </div>
    </div>
  )
}
