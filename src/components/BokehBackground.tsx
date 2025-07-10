import React, { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface BokehCircle {
  id: number
  x: number
  y: number
  size: number
  color: string
  duration: number
  delay: number
  blur: number
}

export default function BokehBackground() {
  const { isDark } = useTheme()
  const [circles, setCircles] = useState<BokehCircle[]>([])

  // Color palettes for rainy city night theme
  const lightModeColors = [
    'rgba(0, 207, 245, 0.3)', // Primary 500 - cool teal
    'rgba(0, 181, 216, 0.25)', // Primary 600 - deeper teal
    'rgba(255, 231, 56, 0.4)', // Secondary 400 - warm yellow
    'rgba(230, 199, 0, 0.3)', // Secondary 600 - amber
    'rgba(255, 0, 168, 0.2)', // Tertiary 500 - subtle pink
    'rgba(180, 241, 251, 0.4)', // Primary 100 - light blue
  ]

  const darkModeColors = [
    'rgba(0, 129, 158, 0.4)', // Primary 800 - deep blue
    'rgba(0, 77, 97, 0.3)', // Primary 950 - darkest blue
    'rgba(255, 231, 56, 0.3)', // Secondary 400 - streetlight yellow
    'rgba(204, 176, 0, 0.3)', // Secondary 700 - warm amber
    'rgba(255, 0, 168, 0.25)', // Tertiary 500 - neon pink
    'rgba(30, 41, 59, 0.6)', // Deep blue-gray for depth
  ]

  // Separate settings for light and dark modes
  const lightModeSettings = {
    count: { min: 15, max: 21 }, // 15-20 circles
    size: { min: 200, max: 1000 }, // Customizable size range
    blur: { min: 20, max: 200 }, // Customizable blur range
    duration: { min: 15, max: 35 }, // Animation duration
    delay: { min: 0, max: 10 } // Animation delay
  }

  const darkModeSettings = {
    count: { min: 15, max: 21 }, // 15-20 circles
    size: { min: 20, max: 200 }, // Current dark mode settings
    blur: { min: 6, max: 30 }, // Current dark mode settings
    duration: { min: 15, max: 35 }, // Animation duration
    delay: { min: 0, max: 10 } // Animation delay
  }

  const generateCircles = () => {
    const colors = isDark ? darkModeColors : lightModeColors
    const settings = isDark ? darkModeSettings : lightModeSettings
    const newCircles: BokehCircle[] = []
    
    // Generate circles with theme-specific settings
    const circleCount = Math.floor(Math.random() * (settings.count.max - settings.count.min + 1)) + settings.count.min
    
    for (let i = 0; i < circleCount; i++) {
      newCircles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * (settings.size.max - settings.size.min) + settings.size.min,
        color: colors[Math.floor(Math.random() * colors.length)],
        duration: Math.random() * (settings.duration.max - settings.duration.min) + settings.duration.min,
        delay: Math.random() * (settings.delay.max - settings.delay.min) + settings.delay.min,
        blur: Math.random() * (settings.blur.max - settings.blur.min) + settings.blur.min,
      })
    }
    
    setCircles(newCircles)
  }

  useEffect(() => {
    generateCircles()
  }, [isDark])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Bokeh circles for both modes */}
      {circles.map((circle) => (
        <div
          key={circle.id}
          className="absolute rounded-full bokeh-circle"
          style={{
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            width: `${circle.size}px`,
            height: `${circle.size}px`,
            backgroundColor: circle.color,
            filter: `blur(${circle.blur}px)`,
            animationDuration: `${circle.duration}s`,
            animationDelay: `${circle.delay}s`,
          }}
        />
      ))}
    </div>
  )
} 