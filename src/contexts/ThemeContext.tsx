import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | null // null = follow system

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  clearTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function updateTheme() {
  document.documentElement.classList.toggle(
    'dark',
    localStorage.theme === 'dark' ||
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
}

function getCurrentTheme(): Theme {
  if (!('theme' in localStorage)) return null
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return null
}

function getIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return null
    return getCurrentTheme()
  })

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return getIsDark()
  })

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    
    if (newTheme === 'light') {
      localStorage.theme = 'light'
    } else if (newTheme === 'dark') {
      localStorage.theme = 'dark'
    } else {
      localStorage.removeItem('theme')
    }
    
    updateTheme()
    setIsDark(getIsDark())
  }

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('light')
    } else {
      // If no preference set, toggle to opposite of current system
      const currentlyDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(currentlyDark ? 'light' : 'dark')
    }
  }

  const clearTheme = () => {
    setTheme(null)
  }

  useEffect(() => {
    updateTheme()
    setIsDark(getIsDark())
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (!('theme' in localStorage)) {
        updateTheme()
        setIsDark(getIsDark())
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, clearTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 