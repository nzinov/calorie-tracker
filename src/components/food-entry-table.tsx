"use client"

interface FoodEntry {
  id: string
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  timestamp: Date
}

interface FoodEntryTableProps {
  entries: FoodEntry[]
  onEdit?: (entry: FoodEntry) => void
  onDelete?: (id: string) => void
}

export function FoodEntryTable({ entries, onEdit, onDelete }: FoodEntryTableProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 h-full">
      {entries.length === 0 ? (
        <div className="grid place-items-center h-full">
          <p className="text-sm md:text-base text-gray-700 text-center">No food entries yet today</p>
        </div>
      ) : (
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Time</th>
                <th className="text-left py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Food</th>
                <th className="text-left py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Quantity</th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Cal</th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Protein</th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Carbs</th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Fat</th>
                <th className="text-right py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Fiber</th>
                <th className="text-center py-2 md:py-3 px-2 md:px-4 font-semibold text-gray-900 text-xs md:text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2 md:py-3 px-2 md:px-4 text-gray-800 text-xs md:text-sm">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="py-2 md:py-3 px-2 md:px-4 font-medium text-gray-900 text-xs md:text-sm">{entry.name}</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-gray-800 text-xs md:text-sm">{entry.quantity}</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-right font-medium text-gray-900 text-xs md:text-sm">{entry.calories.toFixed(0)}</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-right text-gray-800 text-xs md:text-sm">{entry.protein.toFixed(1)}g</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-right text-gray-800 text-xs md:text-sm">{entry.carbs.toFixed(1)}g</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-right text-gray-800 text-xs md:text-sm">{entry.fat.toFixed(1)}g</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-right text-gray-800 text-xs md:text-sm">{entry.fiber.toFixed(1)}g</td>
                  <td className="py-2 md:py-3 px-2 md:px-4 text-center">
                    <div className="flex justify-center space-x-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(entry)}
                          className="text-blue-700 hover:text-blue-900 text-xs md:text-sm font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="text-red-600 hover:text-red-800 text-xs md:text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
