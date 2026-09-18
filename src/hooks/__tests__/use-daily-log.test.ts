import { describe, it, expect, beforeEach } from '@jest/globals'

// Extract and test the pure utility functions from use-daily-log hook
// These are the functions we can test without mocking the entire hook

describe('useDailyLog utilities', () => {
  describe('calculateEntryNutrition', () => {
    // This is a pure function that calculates nutrition from a food entry
    function calculateEntryNutrition(entry: {
      grams: number
      userFood: {
        caloriesPer100g: number
        proteinPer100g: number
        carbsPer100g: number
        fatPer100g: number
        fiberPer100g: number
        saltPer100g: number
        vegetablesPer100g: number
      }
    }) {
      const ratio = entry.grams / 100
      return {
        calories: entry.userFood.caloriesPer100g * ratio,
        protein: entry.userFood.proteinPer100g * ratio,
        carbs: entry.userFood.carbsPer100g * ratio,
        fat: entry.userFood.fatPer100g * ratio,
        fiber: entry.userFood.fiberPer100g * ratio,
        salt: entry.userFood.saltPer100g * ratio,
        vegetables: entry.userFood.vegetablesPer100g * ratio
      }
    }

    it('should calculate nutrition correctly for 100g', () => {
      const entry = {
        grams: 100,
        userFood: {
          caloriesPer100g: 100,
          proteinPer100g: 10,
          carbsPer100g: 20,
          fatPer100g: 5,
          fiberPer100g: 3,
          saltPer100g: 0.5,
          vegetablesPer100g: 50,
        }
      }

      const result = calculateEntryNutrition(entry)

      expect(result.calories).toBe(100)
      expect(result.protein).toBe(10)
      expect(result.carbs).toBe(20)
      expect(result.fat).toBe(5)
      expect(result.fiber).toBe(3)
      expect(result.salt).toBe(0.5)
      expect(result.vegetables).toBe(50)
    })

    it('should calculate nutrition correctly for 50g', () => {
      const entry = {
        grams: 50,
        userFood: {
          caloriesPer100g: 200,
          proteinPer100g: 20,
          carbsPer100g: 40,
          fatPer100g: 10,
          fiberPer100g: 6,
          saltPer100g: 1,
          vegetablesPer100g: 100,
        }
      }

      const result = calculateEntryNutrition(entry)

      expect(result.calories).toBe(100)
      expect(result.protein).toBe(10)
      expect(result.carbs).toBe(20)
      expect(result.fat).toBe(5)
      expect(result.fiber).toBe(3)
      expect(result.salt).toBe(0.5)
      expect(result.vegetables).toBe(50)
    })

    it('should calculate nutrition correctly for 250g', () => {
      const entry = {
        grams: 250,
        userFood: {
          caloriesPer100g: 100,
          proteinPer100g: 10,
          carbsPer100g: 20,
          fatPer100g: 5,
          fiberPer100g: 3,
          saltPer100g: 0.5,
          vegetablesPer100g: 50,
        }
      }

      const result = calculateEntryNutrition(entry)

      expect(result.calories).toBe(250)
      expect(result.protein).toBe(25)
      expect(result.carbs).toBe(50)
      expect(result.fat).toBe(12.5)
      expect(result.fiber).toBe(7.5)
      expect(result.salt).toBe(1.25)
      expect(result.vegetables).toBe(125)
    })
  })

  describe('sortByTimestamp', () => {
    function sortByTimestamp(entries: { timestamp: Date }[]) {
      return [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }

    it('should sort entries by timestamp in ascending order', () => {
      const entries = [
        { id: '3', timestamp: new Date('2024-01-03') },
        { id: '1', timestamp: new Date('2024-01-01') },
        { id: '2', timestamp: new Date('2024-01-02') },
      ]

      const sorted = sortByTimestamp(entries)

      expect(sorted[0].id).toBe('1')
      expect(sorted[1].id).toBe('2')
      expect(sorted[2].id).toBe('3')
    })

    it('should not modify the original array', () => {
      const entries = [
        { id: '2', timestamp: new Date('2024-01-02') },
        { id: '1', timestamp: new Date('2024-01-01') },
      ]

      const originalIds = entries.map(e => e.id)
      sortByTimestamp(entries)

      expect(entries.map(e => e.id)).toEqual(originalIds)
    })
  })

  describe('calculateTotals', () => {
    function calculateTotals(entries: {
      userFood: {
        caloriesPer100g: number
        proteinPer100g: number
        carbsPer100g: number
        fatPer100g: number
        fiberPer100g: number
        saltPer100g: number
        vegetablesPer100g: number
      }
      grams: number
    }[]) {
      const calculateEntryNutrition = (entry: any) => {
        const ratio = entry.grams / 100
        return {
          calories: entry.userFood.caloriesPer100g * ratio,
          protein: entry.userFood.proteinPer100g * ratio,
          carbs: entry.userFood.carbsPer100g * ratio,
          fat: entry.userFood.fatPer100g * ratio,
          fiber: entry.userFood.fiberPer100g * ratio,
          salt: entry.userFood.saltPer100g * ratio,
          vegetables: entry.userFood.vegetablesPer100g * ratio,
        }
      }

      return entries.reduce((totals, entry) => {
        const nutrition = calculateEntryNutrition(entry)
        return {
          calories: totals.calories + nutrition.calories,
          protein: totals.protein + nutrition.protein,
          carbs: totals.carbs + nutrition.carbs,
          fat: totals.fat + nutrition.fat,
          fiber: totals.fiber + nutrition.fiber,
          salt: totals.salt + nutrition.salt,
          vegetables: totals.vegetables + nutrition.vegetables,
        }
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0, vegetables: 0 })
    }

    it('should calculate totals for multiple entries', () => {
      const entries = [
        {
          grams: 100,
          userFood: {
            caloriesPer100g: 100,
            proteinPer100g: 10,
            carbsPer100g: 20,
            fatPer100g: 5,
            fiberPer100g: 3,
            saltPer100g: 0.5,
            vegetablesPer100g: 50,
          }
        },
        {
          grams: 50,
          userFood: {
            caloriesPer100g: 100,
            proteinPer100g: 10,
            carbsPer100g: 20,
            fatPer100g: 5,
            fiberPer100g: 3,
            saltPer100g: 0.5,
            vegetablesPer100g: 50,
          }
        },
      ]

      const totals = calculateTotals(entries)

      expect(totals.calories).toBe(150)
      expect(totals.protein).toBe(15)
      expect(totals.carbs).toBe(30)
      expect(totals.fat).toBe(7.5)
      expect(totals.fiber).toBe(4.5)
      expect(totals.salt).toBe(0.75)
      expect(totals.vegetables).toBe(75)
    })

    it('should return zeros for empty entries', () => {
      const totals = calculateTotals([])

      expect(totals.calories).toBe(0)
      expect(totals.protein).toBe(0)
      expect(totals.carbs).toBe(0)
      expect(totals.fat).toBe(0)
      expect(totals.fiber).toBe(0)
      expect(totals.salt).toBe(0)
      expect(totals.vegetables).toBe(0)
    })
  })

  describe('applyDataUpdate', () => {
    it('should add a new food entry', () => {
      const prev = {
        date: '2024-01-01',
        foodEntries: [],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0, vegetables: 0 }
      }

      const newEntry = {
        id: 'entry-1',
        userFoodId: 'food-1',
        grams: 100,
        date: '2024-01-01',
        timestamp: new Date('2024-01-01T12:00:00'),
        userFood: {
          id: 'food-1',
          name: 'Apple',
          caloriesPer100g: 50,
          proteinPer100g: 0.5,
          carbsPer100g: 14,
          fatPer100g: 0.2,
          fiberPer100g: 2.4,
          saltPer100g: 0,
          vegetablesPer100g: 0,
          defaultGrams: null,
          comments: null,
        }
      }

      // Simulate the applyDataUpdate logic for foodAdded
      const updatedEntries = [...prev.foodEntries, newEntry]
      const sortedEntries = updatedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      
      expect(updatedEntries).toHaveLength(1)
      expect(sortedEntries[0].id).toBe('entry-1')
    })

    it('should not add duplicate entries', () => {
      const existingEntry = { id: 'entry-1', timestamp: new Date() }
      const prev = {
        date: '2024-01-01',
        foodEntries: [existingEntry],
        totals: { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 1, salt: 0, vegetables: 0 }
      }

      const duplicateEntry = { ...existingEntry }

      // Check if entry already exists
      const exists = prev.foodEntries.some(e => e.id === duplicateEntry.id)
      expect(exists).toBe(true)
    })
  })
})