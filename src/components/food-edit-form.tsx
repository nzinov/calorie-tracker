"use client"

import { useState, useEffect } from "react"
import { UserFood } from "./food-database-table"

interface FoodEditFormProps {
  food: UserFood | null  // null for new food, UserFood for editing
  onSave: (food: Partial<UserFood> & { name: string }) => Promise<void>
  onCancel: () => void
}

export function FoodEditForm({ food, onSave, onCancel }: FoodEditFormProps) {
  const [name, setName] = useState("")
  const [caloriesPer100g, setCaloriesPer100g] = useState("")
  const [proteinPer100g, setProteinPer100g] = useState("")
  const [carbsPer100g, setCarbsPer100g] = useState("")
  const [fatPer100g, setFatPer100g] = useState("")
  const [fiberPer100g, setFiberPer100g] = useState("")
  const [saltPer100g, setSaltPer100g] = useState("")
  const [defaultGrams, setDefaultGrams] = useState("")
  const [comments, setComments] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = food !== null

  useEffect(() => {
    if (food) {
      setName(food.name)
      setCaloriesPer100g(food.caloriesPer100g.toString())
      setProteinPer100g(food.proteinPer100g.toString())
      setCarbsPer100g(food.carbsPer100g.toString())
      setFatPer100g(food.fatPer100g.toString())
      setFiberPer100g(food.fiberPer100g.toString())
      setSaltPer100g(food.saltPer100g.toString())
      setDefaultGrams(food.defaultGrams?.toString() || "")
      setComments(food.comments || "")
    } else {
      setName("")
      setCaloriesPer100g("")
      setProteinPer100g("")
      setCarbsPer100g("")
      setFatPer100g("")
      setFiberPer100g("")
      setSaltPer100g("")
      setDefaultGrams("")
      setComments("")
    }
    setError(null)
  }, [food])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    const foodData: Partial<UserFood> & { name: string } = {
      ...(food ? { id: food.id } : {}),
      name: name.trim(),
      caloriesPer100g: parseFloat(caloriesPer100g) || 0,
      proteinPer100g: parseFloat(proteinPer100g) || 0,
      carbsPer100g: parseFloat(carbsPer100g) || 0,
      fatPer100g: parseFloat(fatPer100g) || 0,
      fiberPer100g: parseFloat(fiberPer100g) || 0,
      saltPer100g: parseFloat(saltPer100g) || 0,
      defaultGrams: defaultGrams ? parseFloat(defaultGrams) : null,
      comments: comments.trim() || null
    }

    setSaving(true)
    try {
      await onSave(foodData)
    } catch (err: any) {
      setError(err?.message || "Failed to save food")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 mr-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-medium text-gray-900">
          {isEditing ? "Edit Food" : "Add New Food"}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2 bg-red-100 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Food Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Chicken Breast"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Calories (per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={caloriesPer100g}
              onChange={(e) => setCaloriesPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protein (g per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={proteinPer100g}
              onChange={(e) => setProteinPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Carbs (g per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={carbsPer100g}
              onChange={(e) => setCarbsPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fat (g per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={fatPer100g}
              onChange={(e) => setFatPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fiber (g per 100g)
            </label>
            <input
              type="number"
              step="0.1"
              value={fiberPer100g}
              onChange={(e) => setFiberPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salt (g per 100g)
            </label>
            <input
              type="number"
              step="0.01"
              value={saltPer100g}
              onChange={(e) => setSaltPer100g(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Portion (grams)
          </label>
          <input
            type="number"
            step="1"
            value={defaultGrams}
            onChange={(e) => setDefaultGrams(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Pre-fills the grams input when quick-adding this food.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Grilled, no skin"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Notes about this food.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Food"}
          </button>
        </div>
      </form>
    </div>
  )
}
