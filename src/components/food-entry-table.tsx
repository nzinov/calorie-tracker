"use client"

import { useState } from "react"

interface FoodEntry {
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

interface FoodEntryTableProps {
  entries: FoodEntry[]
  onEdit?: (entry: FoodEntry) => void
  onDelete?: (id: string) => Promise<void>
}

export function FoodEntryTable({ entries, onEdit, onDelete }: FoodEntryTableProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date)
  }

  const handleDelete = async (id: string) => {
    if (!onDelete) return
    
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      await onDelete(id)
    } catch (error) {
      console.error("Failed to delete entry:", error)
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 md:p-4 h-full min-h-0 flex flex-col">
      {entries.length === 0 ? (
        <div className="grid place-items-center h-full">
          <p className="text-sm md:text-base text-gray-700 text-center">No food entries yet today</p>
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="text-left py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Time</th>
                <th className="text-left py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Food</th>
                <th className="text-left py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Quantity</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Cal</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Protein</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Carbs</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Fat</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Fiber</th>
                <th className="text-right py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Salt</th>
                <th className="text-center py-1.5 px-2 md:px-3 font-semibold text-gray-900 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isDeleting = deletingIds.has(entry.id)
                return (
                  <tr key={entry.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="py-1.5 px-2 md:px-3 text-gray-800 text-xs">
                      {formatTime(entry.timestamp)}
                    </td>
                    <td className="py-1.5 px-2 md:px-3 font-medium text-gray-900 text-xs">{entry.name}</td>
                    <td className="py-1.5 px-2 md:px-3 text-gray-800 text-xs">{entry.quantity}</td>
                    <td className="py-1.5 px-2 md:px-3 text-right font-medium text-gray-900 text-xs">{entry.calories.toFixed(0)}</td>
                    <td className="py-1.5 px-2 md:px-3 text-right text-gray-800 text-xs">{entry.protein.toFixed(1)}g</td>
                    <td className="py-1.5 px-2 md:px-3 text-right text-gray-800 text-xs">{entry.carbs.toFixed(1)}g</td>
                    <td className="py-1.5 px-2 md:px-3 text-right text-gray-800 text-xs">{entry.fat.toFixed(1)}g</td>
                    <td className="py-1.5 px-2 md:px-3 text-right text-gray-800 text-xs">{entry.fiber.toFixed(1)}g</td>
                    <td className="py-1.5 px-2 md:px-3 text-right text-gray-800 text-xs">{entry.salt.toFixed(1)}g</td>
                    <td className="py-1.5 px-2 md:px-3 text-center">
                      <div className="flex justify-center space-x-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(entry)}
                            disabled={isDeleting}
                            className="text-blue-700 hover:text-blue-900 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
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
