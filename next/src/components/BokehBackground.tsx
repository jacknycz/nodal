'use client'

import React, { useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface ParticleStyles {
  count: number
  sizeRange: [number, number]
  speedRange: [number, number]
  opacityRange: [number, number]
  color: string
  background: string
}

const themeStyles: Record<'light' | 'dark', ParticleStyles> = {
  light: {
    count: 30,
    sizeRange: [3, 80], // Larger dots
    speedRange: [-0.3, 0.3], // Slightly slower movement
    opacityRange: [0.01, 0.03], // More subtle opacity
    color: '0, 0, 0', // Black dots
    background: '#f9f9f9' // Light gray background with some transparency
  },
  dark: {
    count: 50,
    sizeRange: [1, 4], // Smaller dots
    speedRange: [-0.5, 0.5], // Current speed
    opacityRange: [0.1, 0.5], // Current opacity
    color: '255, 255, 255', // White dots
    background: 'transparent' // Transparent background
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
    }> = []
    
    // Helper function to get random number in range
    const random = (min: number, max: number) => Math.random() * (max - min) + min
    
    // Initialize particles with theme-specific styles
    for (let i = 0; i < styles.count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: random(...styles.sizeRange),
        speedX: random(...styles.speedRange),
        speedY: random(...styles.speedRange),
        opacity: random(...styles.opacityRange),
      })
    }
    
    function animate() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY
        
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1
        
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${styles.color}, ${particle.opacity})`
        ctx.fill()
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