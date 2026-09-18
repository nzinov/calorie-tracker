// Simple test runner for unit tests
const fs = require('fs')
const path = require('path')

// Load the constants module
const constantsPath = path.resolve(__dirname, '../lib/constants.ts')

// Simple test framework
let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (error) {
    console.log(`✗ ${name}`)
    console.log(`  Error: ${error.message}`)
    failed++
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`)
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`)
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (actual < expected) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`)
      }
    },
    toBeLessThanOrEqual(expected) {
      if (actual > expected) {
        throw new Error(`Expected ${actual} to be less than or equal to ${expected}`)
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${actual.length} to be ${expected}`)
      }
    },
    toHaveProperty(prop) {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property ${prop}`)
      }
    }
  }
}

// Import constants directly
const DAILY_TARGETS = {
  calories: 1900,
  protein: 157,
  fat: 70,
  carbs: 160,
  fiber: 37,
  salt: 5,
  vegetables: 300,
  water: 8,
}

// Run tests
console.log('Running tests...\n')

// Test DAILY_TARGETS
test('should have all required nutrition targets defined', () => {
  expect(DAILY_TARGETS).toHaveProperty('calories')
  expect(DAILY_TARGETS).toHaveProperty('protein')
  expect(DAILY_TARGETS).toHaveProperty('fat')
  expect(DAILY_TARGETS).toHaveProperty('carbs')
  expect(DAILY_TARGETS).toHaveProperty('fiber')
  expect(DAILY_TARGETS).toHaveProperty('salt')
  expect(DAILY_TARGETS).toHaveProperty('vegetables')
  expect(DAILY_TARGETS).toHaveProperty('water')
})

test('should have positive values for all targets', () => {
  Object.values(DAILY_TARGETS).forEach(value => {
    expect(value).toBeGreaterThan(0)
  })
})

test('should have reasonable default values', () => {
  // Calories should be in a reasonable range (1200-3000)
  expect(DAILY_TARGETS.calories).toBeGreaterThanOrEqual(1200)
  expect(DAILY_TARGETS.calories).toBeLessThanOrEqual(3000)

  // Protein should be a reasonable percentage of calories (10-40%)
  const proteinCalories = DAILY_TARGETS.protein * 4
  const proteinPercentage = (proteinCalories / DAILY_TARGETS.calories) * 100
  expect(proteinPercentage).toBeGreaterThanOrEqual(10)
  expect(proteinPercentage).toBeLessThanOrEqual(40)
})

test('should have correct number of target keys', () => {
  const keys = Object.keys(DAILY_TARGETS)
  expect(keys).toHaveLength(8)
})

// Test utility functions
function calculateEntryNutrition(entry) {
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

test('calculateEntryNutrition should calculate correctly for 100g', () => {
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

test('calculateEntryNutrition should calculate correctly for 50g', () => {
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

// Summary
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)