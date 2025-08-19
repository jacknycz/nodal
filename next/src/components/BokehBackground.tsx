'use client'

import React, { useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface ParticleStyles {
  count: number
  sizeRange: [number, number]
  speedRange: [number, number]
  opacityRange: [number, number]
  colors: string[]
  background: string
  glowIntensity: number
  glowOpacity: number
}

const themeStyles: Record<'light' | 'dark', ParticleStyles> = {
  light: {
    count: 30,
    sizeRange: [3, 240], // Larger dots
    speedRange: [-0.3, 0.3], // Slightly slower movement
    opacityRange: [0.01, 0.03], // More subtle opacity
    colors: ['0, 207, 245', '255, 222, 0', '255, 0, 168'], // Primary, Secondary, Tertiary-500
    background: '#ffffff', // Light gray background with some transparency
    glowIntensity: 0.3, // Subtle glow for light theme
    glowOpacity: 0.2 // Glow opacity multiplier
  },
  dark: {
    count: 50,
    sizeRange: [1, 80], // Smaller dots
    speedRange: [-0.05, 0.05], // Current speed
    opacityRange: [0.01, 0.02], // Current opacity
    colors: ['0, 207, 245', '255, 222, 0', '255, 0, 168'], // Primary, Secondary, Tertiary-500
    background: 'transparent', // Transparent background
    glowIntensity: 0.8, // More pronounced glow for dark theme
    glowOpacity: 0.4 // Glow opacity multiplier
  }
}

export default function BokehBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { isDark } = useTheme()
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const styles = isDark ? themeStyles.dark : themeStyles.light
    
    const particles: Array<{
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
      color: string
    }> = []
    
    // Helper function to get random number in range
    const random = (min: number, max: number) => Math.random() * (max - min) + min
    
    // Initialize particles with theme-specific styles
    const numColors = styles.colors.length
    for (let i = 0; i < styles.count; i++) {
      // Evenly distribute colors across particles: partition by index
      const colorIndex = Math.floor(i * numColors / styles.count)
      const color = styles.colors[colorIndex % numColors]

      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: random(...styles.sizeRange),
        speedX: random(...styles.speedRange),
        speedY: random(...styles.speedRange),
        opacity: random(...styles.opacityRange),
        color
      })
    }
    
    function animate() {
      if (!canvas || !ctx) return
      
      // Clear the canvas properly
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw background if not transparent
      if (styles.background !== 'transparent') {
        ctx.fillStyle = styles.background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      
      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY
        
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1
        
        // Set up glow effect using particle-specific color
        ctx.shadowBlur = particle.size * styles.glowIntensity
        ctx.shadowColor = `rgba(${particle.color}, ${particle.opacity * styles.glowOpacity})`
        
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${particle.color}, ${particle.opacity})`
        ctx.fill()
        
        // Reset shadow to prevent affecting other particles
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
      })
      
      requestAnimationFrame(animate)
    }
    
    animate()
    
    const handleResize = () => {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isDark]) // Re-run effect when theme changes
  
  const styles = isDark ? themeStyles.dark : themeStyles.light
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: styles.background }}
    />
  )
} 