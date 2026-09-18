import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { render, screen, cleanup } from '@testing-library/react'
import { ProgressBar } from '../progress-bar'

describe('ProgressBar', () => {
  afterEach(() => {
    cleanup()
  })

  describe('basic rendering', () => {
    it('should render with required props', () => {
      render(
        <ProgressBar
          label="Test Nutrient"
          current={50}
          target={100}
          unit="g"
        />
      )
      
      expect(screen.getByText('Test Nutrient')).toBeInTheDocument()
      expect(screen.getByText('50.0/100 g')).toBeInTheDocument()
    })

    it('should display the correct percentage', () => {
      render(
        <ProgressBar
          label="Calories"
          current={500}
          target={1000}
          unit="kcal"
        />
      )
      
      expect(screen.getByText('50.0%')).toBeInTheDocument()
    })

    it('should cap percentage at 100%', () => {
      render(
        <ProgressBar
          label="Protein"
          current={150}
          target={100}
          unit="g"
        />
      )
      
      // The visual bar should be capped at 100%
      const bar = document.querySelector('.bg-blue-500, .bg-red-500')
      expect(bar).toHaveStyle({ width: '100%' })
    })
  })

  describe('when over target', () => {
    it('should show red color when current exceeds target', () => {
      render(
        <ProgressBar
          label="Salt"
          current={10}
          target={5}
          unit="g"
          color="bg-blue-500"
        />
      )
      
      expect(screen.getByText('10.0/5 g')).toBeInTheDocument()
      const redBar = document.querySelector('.bg-red-500')
      expect(redBar).toBeInTheDocument()
    })

    it('should show red text when current exceeds target', () => {
      render(
        <ProgressBar
          label="Fat"
          current={80}
          target={70}
          unit="g"
        />
      )
      
      const label = screen.getByText('80.0/70 g')
      expect(label).toHaveClass('text-red-700')
    })
  })

  describe('compact mode', () => {
    it('should render only the progress bar in compact mode', () => {
      render(
        <ProgressBar
          label="Fiber"
          current={20}
          target={40}
          unit="g"
          compact
        />
      )
      
      // In compact mode, the label and numbers should not be visible
      expect(screen.queryByText('Fiber')).not.toBeInTheDocument()
      expect(screen.queryByText('20.0/40 g')).not.toBeInTheDocument()
      
      // But the progress bar should still exist
      const progressBar = document.querySelector('.bg-blue-500')
      expect(progressBar).toBeInTheDocument()
    })

    it('should show red when over target in compact mode', () => {
      render(
        <ProgressBar
          label="Carbs"
          current={100}
          target={50}
          unit="g"
          compact
        />
      )
      
      const redBar = document.querySelector('.bg-red-500')
      expect(redBar).toBeInTheDocument()
    })
  })

  describe('custom color', () => {
    it('should apply custom color class', () => {
      render(
        <ProgressBar
          label="Custom"
          current={50}
          target={100}
          unit="g"
          color="bg-green-500"
        />
      )
      
      const greenBar = document.querySelector('.bg-green-500')
      expect(greenBar).toBeInTheDocument()
    })
  })

  describe('showTarget option', () => {
    it('should hide target when showTarget is false', () => {
      render(
        <ProgressBar
          label="Protein"
          current={50}
          target={100}
          unit="g"
          showTarget={false}
        />
      )
      
      expect(screen.getByText('50.0 g')).toBeInTheDocument()
      expect(screen.queryByText('/100')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle zero target without division by zero', () => {
      render(
        <ProgressBar
          label="Zero Target"
          current={50}
          target={0}
          unit="g"
        />
      )
      
      // Should render without errors
      expect(screen.getByText('Zero Target')).toBeInTheDocument()
    })

    it('should handle zero current', () => {
      render(
        <ProgressBar
          label="Empty"
          current={0}
          target={100}
          unit="g"
        />
      )
      
      expect(screen.getByText('0.0/100 g')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('should handle when current equals target', () => {
      render(
        <ProgressBar
          label="Exact"
          current={100}
          target={100}
          unit="g"
        />
      )
      
      expect(screen.getByText('100.0/100 g')).toBeInTheDocument()
      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })
  })
})