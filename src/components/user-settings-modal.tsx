"use client"

import React, { useEffect, useState } from "react"
import { useUserSettings } from "@/contexts/user-settings"

type Props = {
  open: boolean
  onClose: () => void
}

export function UserSettingsModal({ open, onClose }: Props) {
  const { targets, saveTargets, loading } = useUserSettings()
  const [form, setForm] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm({ ...targets })
      setError(null)
    }
  }, [open, targets])

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">User Settings</h2>
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
    </div>
  )
}
