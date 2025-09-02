"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { DAILY_TARGETS } from "@/lib/constants"

interface WeeklyData {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

interface WeeklyProgressChartProps {
  data: WeeklyData[]
}

export function WeeklyProgressChart({ data }: WeeklyProgressChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-medium">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
              {entry.dataKey === "calories" ? " kcal" : "g"}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Progress</h3>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="calories" 
              stroke="#f97316" 
              strokeWidth={2}
              name="Calories"
            />
            <Line 
              type="monotone" 
              dataKey="protein" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Protein"
            />
            <Line 
              type="monotone" 
              dataKey="carbs" 
              stroke="#eab308" 
              strokeWidth={2}
              name="Carbs"
            />
            <Line 
              type="monotone" 
              dataKey="fat" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Fat"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="text-center">
          <div className="text-orange-500 font-medium">Calories Target</div>
          <div className="text-gray-600">{DAILY_TARGETS.calories} kcal</div>
        </div>
        <div className="text-center">
          <div className="text-red-500 font-medium">Protein Target</div>
          <div className="text-gray-600">{DAILY_TARGETS.protein}g</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-500 font-medium">Carbs Target</div>
          <div className="text-gray-600">{DAILY_TARGETS.carbs}g</div>
        </div>
        <div className="text-center">
          <div className="text-purple-500 font-medium">Fat Target</div>
          <div className="text-gray-600">{DAILY_TARGETS.fat}g</div>
        </div>
      </div>
    </div>
  )
}
