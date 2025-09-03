"use client"

import { AuthButton } from "@/components/auth-button"
import { AuthGuard } from "@/components/auth-guard"
import { ChatInterface } from "@/components/chat-interface"
import { FoodEntryTable } from "@/components/food-entry-table"
import { NutritionDashboard } from "@/components/nutrition-dashboard"
import { useDailyLog } from "@/hooks/use-daily-log"
import { useState } from "react"

export default function Home() {
  const [activeTab, setActiveTab] = useState<"today" | "charts">("today")
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const { data, loading, error, addFoodEntry, deleteFoodEntry, refetch, updateData } = useDailyLog(selectedDate)

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteFoodEntry(id)
    } catch (error) {
      console.error("Failed to delete entry:", error)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading your nutrition data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
          <p className="mt-2 text-gray-700">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="h-screen bg-gray-100 grid grid-rows-[auto_1fr]">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">Calorie Tracker</h1>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab("today")}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "today"
                        ? "bg-blue-500 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    Daily View
                  </button>
                  <button
                    onClick={() => setActiveTab("charts")}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "charts"
                        ? "bg-blue-500 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    Charts
                  </button>
                </div>
                <AuthButton />
              </div>
            </div>
          </div>
        </header>

      <main className="min-h-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full grid grid-rows-[auto_1fr] gap-8">
        {activeTab === "today" ? (
          <>
            {/* Top section: Daily Progress and Food Log side by side - same height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              <div className="lg:col-span-1 relative h-96">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
                <NutritionDashboard data={data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }} />
              </div>
              
              <div className="lg:col-span-2 relative h-96">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
                <FoodEntryTable 
                  entries={data?.dailyLog?.foodEntries || []}
                  onEdit={(entry) => console.log("Edit:", entry)}
                  onDelete={handleDeleteEntry}
                />
              </div>
            </div>
            
            {/* Bottom section: Chat takes all remaining vertical space */}
            <div className="min-h-0">
              <ChatInterface 
                currentTotals={data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }}
                foodEntries={data?.dailyLog?.foodEntries || []}
                onDataUpdate={updateData}
                date={selectedDate}
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Charts Coming Soon</h3>
              <p className="text-gray-700">Chart visualizations will be available in a future update.</p>
            </div>
          </div>
        )}
        </div>
      </main>
      </div>
    </AuthGuard>
  )
}
