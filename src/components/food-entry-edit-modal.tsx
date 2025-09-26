"use client"

import { useEffect, useState } from "react"

type FoodEntry = {
  id: string
  name: string
  quantity: string
  portionSizeGrams: number
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  saltPer100g: number
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
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) {
      setForm(entry)
      setError(null)
    }
  }, [entry])

  const update = (key: keyof FoodEntry, value: string | number) => {
    setForm(prev => {
      if (!prev) return prev
      
      
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
            <span className="block text-gray-900 mb-1">Calories per 100g (kcal)</span>
            <input 
              type="number" 
              value={form.caloriesPer100g}
              onChange={e => update('caloriesPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Protein per 100g (g)</span>
            <input 
              type="number" 
              value={form.proteinPer100g}
              onChange={e => update('proteinPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Carbs per 100g (g)</span>
            <input 
              type="number" 
              value={form.carbsPer100g}
              onChange={e => update('carbsPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Fat per 100g (g)</span>
            <input 
              type="number" 
              value={form.fatPer100g}
              onChange={e => update('fatPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Fiber per 100g (g)</span>
            <input 
              type="number" 
              value={form.fiberPer100g}
              onChange={e => update('fiberPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Salt per 100g (g)</span>
            <input 
              type="number" 
              value={form.saltPer100g}
              onChange={e => update('saltPer100g', Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900" 
            />
          </label>

          <label className="text-sm text-gray-900">
            <span className="block text-gray-900 mb-1">Portion Size (g)</span>
            <input 
              type="number" 
              value={form.portionSizeGrams}
              onChange={e => update('portionSizeGrams', Number(e.target.value) || 0)}
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