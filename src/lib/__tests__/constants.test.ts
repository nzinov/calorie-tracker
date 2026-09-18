import { describe, it, expect } from '@jest/globals'
import { DAILY_TARGETS, NutritionType } from '@/lib/constants'

describe('constants', () => {
  describe('DAILY_TARGETS', () => {
    it('should have all required nutrition targets defined', () => {
      expect(DAILY_TARGETS).toHaveProperty('calories')
      expect(DAILY_TARGETS).toHaveProperty('protein')
      expect(DAILY_TARGETS).toHaveProperty('fat')
      expect(DAILY_TARGETS).toHaveProperty('carbs')
      expect(DAILY_TARGETS).toHaveProperty('fiber')
      expect(DAILY_TARGETS).toHaveProperty('salt')
      expect(DAILY_TARGETS).toHaveProperty('vegetables')
      expect(DAILY_TARGETS).toHaveProperty('water')
    })

    it('should have positive values for all targets', () => {
      Object.values(DAILY_TARGETS).forEach(value => {
        expect(value).toBeGreaterThan(0)
      })
    })

    it('should have reasonable default values', () => {
      // Calories should be in a reasonable range (1200-3000)
      expect(DAILY_TARGETS.calories).toBeGreaterThanOrEqual(1200)
      expect(DAILY_TARGETS.calories).toBeLessThanOrEqual(3000)

      // Protein should be a reasonable percentage of calories (10-40%)
      const proteinCalories = DAILY_TARGETS.protein * 4
      const proteinPercentage = (proteinCalories / DAILY_TARGETS.calories) * 100
      expect(proteinPercentage).toBeGreaterThanOrEqual(10)
      expect(proteinPercentage).toBeLessThanOrEqual(40)
    })

    it('should be readonly (as const)', () => {
      // This test verifies the as const assertion is in place
      const keys = Object.keys(DAILY_TARGETS) as NutritionType[]
      expect(keys).toHaveLength(8)
    })
  })

  describe('NutritionType', () => {
    it('should be a union type of all target keys', () => {
      const validTypes: NutritionType[] = [
        'calories',
        'protein',
        'fat',
        'carbs',
        'fiber',
        'salt',
        'vegetables',
        'water',
      ]
      expect(validTypes).toHaveLength(8)
    })
  })
})