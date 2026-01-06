"use client"

import { AuthButton } from "@/components/auth-button"
import { AuthGuard } from "@/components/auth-guard"
import { ChatInterface } from "@/components/chat-interface"
import { FoodEntryTable } from "@/components/food-entry-table"
import { FoodEntryEditModal } from "@/components/food-entry-edit-modal"
import { NutritionDashboard } from "@/components/nutrition-dashboard"
import { useDailyLog } from "@/hooks/use-daily-log"
import { useUserSettings } from "@/contexts/user-settings"
import { useState, useRef, useEffect } from "react"

type MobileTab = "log" | "items"

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const { data, loading, error, deleteFoodEntry, updateFoodEntry, addFoodEntry, applyDataUpdate } = useDailyLog(selectedDate)
  const { userFoods, fetchUserFoods } = useUserSettings()
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>("log")
  const touchStartX = useRef<number | null>(null)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)

  // Track visual viewport height for mobile keyboard handling
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateHeight = () => {
      const vv = (window as any).visualViewport
      if (vv) {
        setViewportHeight(vv.height)
      } else {
        setViewportHeight(window.innerHeight)
      }
    }

    updateHeight()

    const vv = (window as any).visualViewport
    if (vv) {
      vv.addEventListener('resize', updateHeight)
      vv.addEventListener('scroll', updateHeight)
      return () => {
        vv.removeEventListener('resize', updateHeight)
        vv.removeEventListener('scroll', updateHeight)
      }
    } else {
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX
    const minSwipeDistance = 50

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0 && mobileTab === "log") {
        setMobileTab("items")
      } else if (diff < 0 && mobileTab === "items") {
        setMobileTab("log")
      }
    }
    touchStartX.current = null
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteFoodEntry(id)
    } catch (error) {
      console.error("Failed to delete entry:", error)
    }
  }

  const handleUpdateEntry = async (id: string, updates: {
    grams?: number
    caloriesPer100g?: number
    proteinPer100g?: number
    carbsPer100g?: number
    fatPer100g?: number
    fiberPer100g?: number
    saltPer100g?: number
  }) => {
    try {
      await updateFoodEntry(id, updates)
    } catch (error) {
      console.error("Failed to update entry:", error)
    }
  }

  const handleAddEntry = async (entry: { userFoodId: string; grams: number }) => {
    try {
      await addFoodEntry(entry)
    } catch (error) {
      console.error("Failed to add entry:", error)
      throw error
    }
  }

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry)
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
      <div
        className="bg-gray-100 flex flex-col md:h-screen overflow-hidden"
        style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
      >
        <header className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8">
            <div className="py-1.5 md:py-4 grid grid-cols-2 items-center gap-2">
              <div className="flex items-center justify-start">
                <h1 className="hidden md:block text-2xl font-bold text-gray-900 mr-3">Calorie Tracker</h1>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-1.5 py-0.5 md:px-3 md:py-1 border text-gray-700 border-gray-300 rounded text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto"
                />
              </div>
              <div className="flex items-center justify-end">
                <AuthButton />
              </div>
            </div>
          </div>
        </header>

        {/* Mobile tabs - only visible on small screens */}
        <div className="md:hidden bg-white border-b flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => setMobileTab("log")}
              className={`flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                mobileTab === "log"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent"
              }`}
            >
              Log
            </button>
            <button
              onClick={() => setMobileTab("items")}
              className={`flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                mobileTab === "items"
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent"
              }`}
            >
              Items ({data?.foodEntries?.length || 0})
            </button>
          </div>
        </div>

        {/* Mobile layout */}
        <main
          className="md:hidden flex-1 min-h-0 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Log tab - hidden when not active */}
          <div className={`flex-1 min-h-0 flex flex-col p-4 gap-3 ${mobileTab !== "log" ? "hidden" : ""}`}>
            <div className="flex-shrink-0">
              <NutritionDashboard
                data={data?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 }}
                compact
              />
            </div>
            <div className="flex-1 min-h-0">
              <ChatInterface
                onDataUpdate={(u) => applyDataUpdate(u)}
                date={selectedDate}
                userFoods={userFoods}
                onQuickAdd={handleAddEntry}
                onUserFoodCreated={fetchUserFoods}
              />
            </div>
          </div>
          {/* Items tab - hidden when not active */}
          <div className={`flex-1 min-h-0 p-4 ${mobileTab !== "items" ? "hidden" : ""}`}>
            <FoodEntryTable
              entries={data?.foodEntries || []}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
            />
          </div>
        </main>

        {/* Desktop layout - hidden on mobile */}
        <main className="hidden md:block flex-1 min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full min-h-0 grid grid-rows-[auto_1fr] gap-6">
            {/* Top section: Daily Progress and Food Log side by side */}
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
                  entries={data?.foodEntries || []}
                  onEdit={handleEditEntry}
                  onDelete={handleDeleteEntry}
                />
              </div>
            </div>

            {/* Bottom section: Chat takes all remaining vertical space */}
            <div className="min-h-0 h-full">
              <ChatInterface
                onDataUpdate={(u) => applyDataUpdate(u)}
                date={selectedDate}
                userFoods={userFoods}
                onQuickAdd={handleAddEntry}
                onUserFoodCreated={fetchUserFoods}
              />
            </div>
          </div>
        </main>
      </div>

      {editingEntry && (
        <FoodEntryEditModal
          entry={editingEntry}
          onUpdate={handleUpdateEntry}
          onDelete={handleDeleteEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </AuthGuard>
  )
}
