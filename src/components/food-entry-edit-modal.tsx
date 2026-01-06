"use client"

import { useEffect, useState } from "react"

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

type FoodEntry = {
  id: string
  userFoodId: string
  grams: number
  date: string
  timestamp: Date
  userFood: UserFood
}

type FoodEntryUpdates = {
  grams?: number
  caloriesPer100g?: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  fiberPer100g?: number
  saltPer100g?: number
}

type FoodEntryEditModalProps = {
  entry: FoodEntry | null
  onUpdate: (id: string, updates: FoodEntryUpdates) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export function FoodEntryEditModal({ entry, onUpdate, onDelete, onClose }: FoodEntryEditModalProps) {
  const [grams, setGrams] = useState<string>("")
  const [showNutrition, setShowNutrition] = useState(false)
  const [calories, setCalories] = useState<string>("")
  const [protein, setProtein] = useState<string>("")
  const [carbs, setCarbs] = useState<string>("")
  const [fat, setFat] = useState<string>("")
  const [fiber, setFiber] = useState<string>("")
  const [salt, setSalt] = useState<string>("")
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) {
      setGrams(entry.grams.toString())
      setCalories(entry.userFood.caloriesPer100g.toString())
      setProtein(entry.userFood.proteinPer100g.toString())
      setCarbs(entry.userFood.carbsPer100g.toString())
      setFat(entry.userFood.fatPer100g.toString())
      setFiber(entry.userFood.fiberPer100g.toString())
      setSalt(entry.userFood.saltPer100g.toString())
      setError(null)
      setShowNutrition(false)
    }
  }, [entry])

  const handleUpdate = async () => {
    try {
      if (!entry) return
      const gramsNum = parseFloat(grams)
      if (isNaN(gramsNum) || gramsNum <= 0) {
        setError("Please enter a valid amount in grams")
        return
      }
      setUpdating(true)

      const updates: FoodEntryUpdates = { grams: gramsNum }

      // Check if nutrition values changed
      const caloriesNum = parseFloat(calories)
      const proteinNum = parseFloat(protein)
      const carbsNum = parseFloat(carbs)
      const fatNum = parseFloat(fat)
      const fiberNum = parseFloat(fiber)
      const saltNum = parseFloat(salt)

      if (!isNaN(caloriesNum) && caloriesNum !== entry.userFood.caloriesPer100g) {
        updates.caloriesPer100g = caloriesNum
      }
      if (!isNaN(proteinNum) && proteinNum !== entry.userFood.proteinPer100g) {
        updates.proteinPer100g = proteinNum
      }
      if (!isNaN(carbsNum) && carbsNum !== entry.userFood.carbsPer100g) {
        updates.carbsPer100g = carbsNum
      }
      if (!isNaN(fatNum) && fatNum !== entry.userFood.fatPer100g) {
        updates.fatPer100g = fatNum
      }
      if (!isNaN(fiberNum) && fiberNum !== entry.userFood.fiberPer100g) {
        updates.fiberPer100g = fiberNum
      }
      if (!isNaN(saltNum) && saltNum !== entry.userFood.saltPer100g) {
        updates.saltPer100g = saltNum
      }

      onUpdate(entry.id, updates)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to update entry")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!entry) return

    try {
      setDeleting(true)
      await onDelete(entry.id)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to delete entry")
    } finally {
      setDeleting(false)
    }
  }

  if (!entry) return null

  // Calculate preview nutrition using current input values
  const ratio = parseFloat(grams || "0") / 100
  const currentCalories = parseFloat(calories) || 0
  const currentProtein = parseFloat(protein) || 0
  const currentCarbs = parseFloat(carbs) || 0
  const currentFat = parseFloat(fat) || 0

  const preview = {
    calories: Math.round(currentCalories * ratio),
    protein: (currentProtein * ratio).toFixed(1),
    carbs: (currentCarbs * ratio).toFixed(1),
    fat: (currentFat * ratio).toFixed(1),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Edit Food Entry</h2>

        <div className="space-y-4">
          {/* Food name */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-gray-900">{entry.userFood.name}</div>
            {entry.userFood.comments && (
              <div className="text-xs text-gray-600 mt-1">{entry.userFood.comments}</div>
            )}
          </div>

          {/* Grams input */}
          <label className="block text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Amount (grams)</span>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={grams}
              onChange={e => setGrams(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 text-lg"
            />
          </label>

          {/* Preview nutrition */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-900 mb-1">Nutrition Preview</div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-gray-900">{preview.calories}</div>
                <div className="text-gray-600">kcal</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{preview.protein}g</div>
                <div className="text-gray-600">protein</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{preview.carbs}g</div>
                <div className="text-gray-600">carbs</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{preview.fat}g</div>
                <div className="text-gray-600">fat</div>
              </div>
            </div>
          </div>

          {/* Toggle nutrition editing */}
          <button
            type="button"
            onClick={() => setShowNutrition(!showNutrition)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>{showNutrition ? '▼' : '▶'}</span>
            Edit nutritional info (per 100g)
          </button>

          {/* Nutrition editing fields */}
          {showNutrition && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-3">
              <div className="text-xs text-gray-600 mb-2">
                Changes here will update the food in your database.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="text-gray-700">Calories</span>
                  <input
                    type="number"
                    step="0.1"
                    value={calories}
                    onChange={e => setCalories(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-gray-700">Protein (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={protein}
                    onChange={e => setProtein(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-gray-700">Carbs (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={carbs}
                    onChange={e => setCarbs(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-gray-700">Fat (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={fat}
                    onChange={e => setFat(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-gray-700">Fiber (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={fiber}
                    onChange={e => setFiber(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
                <label className="block text-xs">
                  <span className="text-gray-700">Salt (g)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={salt}
                    onChange={e => setSalt(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 text-sm mt-1"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="px-4 py-2 text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleting || updating}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>

          <button
            className="px-4 py-2 text-gray-800 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            onClick={onClose}
            disabled={deleting || updating}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleUpdate}
            disabled={deleting || updating}
          >
            {updating ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
