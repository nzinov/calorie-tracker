"use client"

import { useState } from "react"

export interface UserFood {
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

interface FoodDatabaseTableProps {
  items: UserFood[]
  onDelete: (id: string) => Promise<void>
  onEdit: (food: UserFood) => void
  onAdd: () => void
}

export function FoodDatabaseTable({ items, onDelete, onEdit, onAdd }: FoodDatabaseTableProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this food? This will also delete any log entries using this food.")) {
      return
    }
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      await onDelete(id)
    } catch (error) {
      console.error("Failed to delete food:", error)
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-900">Food Database</h3>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Food
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search foods..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-8 text-center text-gray-800">
          <p>{items.length === 0 ? "No foods in your database yet." : "No foods match your search."}</p>
          {items.length === 0 && (
            <p className="text-sm text-gray-600 mt-2">Foods will be added automatically when you log meals, or you can add them manually.</p>
          )}
        </div>
      ) : (
        <div className="overflow-auto max-h-96">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="text-left py-2 px-3 font-semibold text-gray-900 text-xs">Name</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Default</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Cal/100g</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Protein</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Carbs</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-900 text-xs">Fat</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-900 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isDeleting = deletingIds.has(item.id)
                return (
                  <tr key={item.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-3 text-gray-800 text-xs font-medium">
                      {item.name}
                      {item.comments && (
                        <span className="block text-gray-500 text-xs font-normal truncate max-w-[200px]" title={item.comments}>
                          {item.comments}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">
                      {item.defaultGrams ? `${item.defaultGrams}g` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs font-medium">{item.caloriesPer100g.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.proteinPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.carbsPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-right text-gray-800 text-xs">{item.fatPer100g.toFixed(1)}g</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => onEdit(item)}
                          disabled={isDeleting}
                          className="text-blue-600 hover:text-blue-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? '...' : 'Delete'}
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

      <div className="mt-3 text-xs text-gray-500">
        {items.length} food{items.length !== 1 ? 's' : ''} in database
      </div>
    </div>
  )
}
