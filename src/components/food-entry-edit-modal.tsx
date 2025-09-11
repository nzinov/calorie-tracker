"use client"

import React, { useEffect, useState } from "react"

type FoodEntry = {
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

type FoodEntryEditModalProps = {
  entry: FoodEntry | null
  onUpdate: (entry: FoodEntry) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export function FoodEntryEditModal({ entry, onUpdate, onDelete, onClose }: FoodEntryEditModalProps) {
  const [form, setForm] = useState<FoodEntry | null>(null)
  const [scaleProportionally, setScaleProportionally] = useState(false)
  const [originalForm, setOriginalForm] = useState<FoodEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) {
      setForm(entry)
      setOriginalForm(entry)
      setError(null)
    }
  }, [entry])

  const update = (key: keyof FoodEntry, value: string | number) => {
    setForm(prev => {
      if (!prev) return prev
      
      // If this is a manual edit to any nutrition field besides calories, 
      // disable proportion scaling for subsequent calorie changes
      if (scaleProportionally && key !== 'calories' && 
          ['protein', 'carbs', 'fat', 'fiber', 'salt'].includes(key)) {
        setScaleProportionally(false)
      }
      
      // If this is a calories update and scale proportionally is checked
      if (key === 'calories' && scaleProportionally && originalForm && originalForm.calories > 0) {
        const newValue = typeof value === 'string' ? Number(value) : value
        if (!isNaN(newValue)) {
          const ratio = newValue / originalForm.calories
          
          return {
            ...prev,
            calories: newValue,
            protein: prev.protein * ratio,
            carbs: prev.carbs * ratio,
            fat: prev.fat * ratio,
            fiber: prev.fiber * ratio,
            salt: prev.salt * ratio
          }
        }
      }
      
      return { ...prev, [key]: value }
    })
  }

  const handleUpdate = async () => {
    try {
      if (!form) return
      setUpdating(true)
      onUpdate(form)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to update entry")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!form) return
    
    try {
      setDeleting(true)
      await onDelete(form.id)
      onClose()
    } catch (e: any) {
      setError(e?.message || "Failed to delete entry")
    } finally {
      setDeleting(false)
    }
  }

  if (!entry || !form) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Edit Food Entry</h2>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Food Name</span>
            <input 
              type="text" 
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>
          
          <label className="col-span-2 text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Quantity</span>
            <input 
              type="text" 
              value={form.quantity}
              onChange={e => update('quantity', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Calories (kcal)</span>
            <input 
              type="number" 
              value={form.calories}
              onChange={e => update('calories', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="col-span-2 flex items-center text-sm text-gray-900">
            <input
              type="checkbox"
              checked={scaleProportionally}
              onChange={e => setScaleProportionally(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Scale nutrition values proportionally to calories (when checking, editing any nutrition value disables this)</span>
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Protein (g)</span>
            <input 
              type="number" 
              value={form.protein}
              onChange={e => update('protein', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Carbs (g)</span>
            <input 
              type="number" 
              value={form.carbs}
              onChange={e => update('carbs', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Fat (g)</span>
            <input 
              type="number" 
              value={form.fat}
              onChange={e => update('fat', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Fiber (g)</span>
            <input 
              type="number" 
              value={form.fiber}
              onChange={e => update('fiber', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Salt (g)</span>
            <input 
              type="number" 
              value={form.salt}
              onChange={e => update('salt', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button 
            className="px-4 py-2 text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50" 
            onClick={handleDelete}
            disabled={deleting || updating}
          >
            {deleting ? 'Deleting...' : 'Delete Entry'}
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
            {updating ? 'Updating...' : 'Update Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}