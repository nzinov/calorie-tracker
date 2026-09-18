import { describe, it, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { NutritionDashboard } from '../nutrition-dashboard'
import { DAILY_TARGETS } from '@/lib/constants'

// Mock the useUserSettings hook
jest.mock('@/contexts/user-settings', () => ({
  useUserSettings: () => ({
    targets: null,
  }),
}))

describe('NutritionDashboard', () => {
  const mockData = {
    calories: 1500,
    protein: 100,
    fat: 50,
    carbs: 150,
    fiber: 20,
    salt: 3,
    vegetables: 200,
  }

  describe('compact mode', () => {
    it('should render all nutrients in compact mode', () => {
      render(<NutritionDashboard data={mockData} compact />)
      
      expect(screen.getByText('Cal')).toBeInTheDocument()
      expect(screen.getByText('Pro')).toBeInTheDocument()
      expect(screen.getByText('Carb')).toBeInTheDocument()
      expect(screen.getByText('Fat')).toBeInTheDocument()
      expect(screen.getByText('Fib')).toBeInTheDocument()
      expect(screen.getByText('Salt')).toBeInTheDocument()
      expect(screen.getByText('Veg')).toBeInTheDocument()
    })

    it('should show remaining amount for each nutrient', () => {
      render(<NutritionDashboard data={mockData} compact />)
      
      // Calories: 1900 target - 1500 current = 400 left
      expect(screen.getByText(/400 kcal left/)).toBeInTheDocument()
      
      // Protein: 157 target - 100 current = 57 left
      expect(screen.getByText(/57g left/)).toBeInTheDocument()
    })

    it('should show "over" when exceeding target', () => {
      const overData = {
        ...mockData,
        calories: 2000, // Over 1900 target
      }
      
      render(<NutritionDashboard data={overData} compact />)
      
      expect(screen.getByText(/100 kcal over/)).toBeInTheDocument()
    })

    it('should show percentage for each nutrient', () => {
      render(<NutritionDashboard data={mockData} compact />)
      
      // Calories: 1500/1900 ≈ 79%
      expect(screen.getByText('79%')).toBeInTheDocument()
    })
  })

  describe('full mode', () => {
    it('should render all nutrients in full mode', () => {
      render(<NutritionDashboard data={mockData} />)
      
      expect(screen.getByText('Calories')).toBeInTheDocument()
      expect(screen.getByText('Protein')).toBeInTheDocument()
      expect(screen.getByText('Carbohydrates')).toBeInTheDocument()
      expect(screen.getByText('Fat')).toBeInTheDocument()
      expect(screen.getByText('Fiber')).toBeInTheDocument()
      expect(screen.getByText('Salt')).toBeInTheDocument()
      expect(screen.getByText('Vegetables')).toBeInTheDocument()
    })

    it('should show values with correct units', () => {
      render(<NutritionDashboard data={mockData} />)
      
      expect(screen.getByText('1500/1900 kcal')).toBeInTheDocument()
      expect(screen.getByText('100/157 g')).toBeInTheDocument()
    })

    it('should show red when over target in full mode', () => {
      const overData = {
        ...mockData,
        protein: 200, // Over 157 target
      }
      
      render(<NutritionDashboard data={overData} />)
      
      const proteinLabel = screen.getByText('200/157 g')
      expect(proteinLabel).toHaveClass('text-red-700')
    })
  })

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const zeroData = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
        salt: 0,
        vegetables: 0,
      }
      
      render(<NutritionDashboard data={zeroData} />)
      
      expect(screen.getByText('0/1900 kcal')).toBeInTheDocument()
    })

    it('should handle missing vegetables value', () => {
      const dataWithoutVegetables = {
        calories: 1000,
        protein: 50,
        fat: 30,
        carbs: 100,
        fiber: 15,
        salt: 2,
        vegetables: 0,
      }
      
      render(<NutritionDashboard data={dataWithoutVegetables} />)
      
      expect(screen.getByText('Vegetables')).toBeInTheDocument()
    })
  })
})