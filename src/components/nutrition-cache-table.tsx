"use client"

import { useState } from "react"

interface NutritionCacheItem {
  id: string
  userId: string
  key: string
  name: string
  portionDescription: string
  portionSizeGrams: number
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  saltPer100g: number
  rawJson: string | null
  createdAt: Date
  updatedAt: Date
}

interface NutritionCacheTableProps {
  items: NutritionCacheItem[]
  onDelete: (id: string) => Promise<void>
}

export function NutritionCacheTable({ items, onDelete }: NutritionCacheTableProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  
  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      await onDelete(id)
    } catch (error) {
      console.error("Failed to delete cache item:", error)
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-md font-semibold mb-4 text-gray-900">Food Cache</h3>
      
      {items.length === 0 ? (
        <div className="py-8 text-center text-gray-800">
          <p>No cached food items yet.</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-900 text-xs">Name</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-900 text-xs">Portion</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Calories</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Protein</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Carbs</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Fat</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Fiber</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Salt</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-900 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isDeleting = deletingIds.has(item.id)
                return (
                  <tr key={item.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-3 text-gray-800 text-xs font-medium">{item.name}</td>
                    <td className="py-2 px-3 text-gray-800 text-xs">{item.portionDescription} ({item.portionSizeGrams}g)</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs font-medium">{item.caloriesPer100g.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.proteinPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.carbsPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.fatPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.fiberPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.saltPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? 'Deleting...' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}