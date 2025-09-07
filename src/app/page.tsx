"use client"

import { AuthButton } from "@/components/auth-button"
import { AuthGuard } from "@/components/auth-guard"
import { ChatInterface } from "@/components/chat-interface"
import { FoodEntryTable } from "@/components/food-entry-table"
import { NutritionDashboard } from "@/components/nutrition-dashboard"
import { useDailyLog } from "@/hooks/use-daily-log"
import { useState } from "react"

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const { data, loading, error, addFoodEntry, deleteFoodEntry, refetch } = useDailyLog(selectedDate)

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
      <div className="md:h-screen bg-gray-100 grid grid-rows-[auto_1fr]">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4 grid grid-cols-2 items-center gap-3">
              <div className="flex items-center justify-start gap-3">
                <h1 className="hidden md:block text-2xl font-bold text-gray-900">Calorie Tracker</h1>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border text-gray-700 border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto"
                />
              </div>
              <div className="flex items-center justify-end">
                <AuthButton />
              </div>
            </div>
          </div>
        </header>

      <main className="min-h-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full min-h-0 grid grid-rows-[auto_1fr] gap-8">
          {/* Top section: Daily Progress and Food Log side by side - same height */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            <div className="lg:col-span-1 relative h-96">
              {loading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}
              <NutritionDashboard data={data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 }} />
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
          <div className="h-96 md:min-h-0 md:h-full">
            <ChatInterface 
              onDataUpdate={refetch}
              date={selectedDate}
            />
          </div>
        </div>
      </main>
      </div>
    </AuthGuard>
  )
}
