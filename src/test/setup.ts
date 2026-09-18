import '@testing-library/jest-dom'
import { afterEach } from 'jest'
import { cleanup } from '@testing-library/react'

// Automatically cleanup after each test
afterEach(() => {
  cleanup()
})