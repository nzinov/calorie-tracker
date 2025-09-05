"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { DAILY_TARGETS } from "@/lib/constants"

interface NutritionData {
  calories: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  salt: number
}

interface NutritionChartProps {
  data: NutritionData
}

const COLORS = {
  protein: "#ef4444", // red
  carbs: "#eab308", // yellow
  fat: "#8b5cf6", // purple
  remaining: "#e5e7eb", // gray
}

export function NutritionChart({ data }: NutritionChartProps) {
  // Calculate calories from macros (protein: 4 cal/g, carbs: 4 cal/g, fat: 9 cal/g)
  const proteinCalories = data.protein * 4
  const carbCalories = data.carbs * 4
  const fatCalories = data.fat * 9
  const totalMacroCalories = proteinCalories + carbCalories + fatCalories
  const remainingCalories = Math.max(0, DAILY_TARGETS.calories - totalMacroCalories)

  const chartData = [
    { name: "Protein", value: proteinCalories, color: COLORS.protein },
    { name: "Carbs", value: carbCalories, color: COLORS.carbs },
    { name: "Fat", value: fatCalories, color: COLORS.fat },
    { name: "Remaining", value: remainingCalories, color: COLORS.remaining },
  ].filter(item => item.value > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow">
          <p className="text-sm">
            <span className="font-medium">{data.name}:</span> {data.value} calories
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Calorie Breakdown</h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry: any) => (
                <span style={{ color: entry.color }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Protein: {data.protein}g ({proteinCalories} cal)</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Carbs: {data.carbs}g ({carbCalories} cal)</span>
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Fat: {data.fat}g ({fatCalories} cal)</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Fiber: {data.fiber}g</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Salt: {data.salt}g</span>
          </div>
        </div>
      </div>
    </div>
  )
}
