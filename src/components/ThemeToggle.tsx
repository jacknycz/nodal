import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme, clearTheme, isDark } = useTheme()

  const getLabel = () => {
    if (theme === 'light') return 'Light'
    if (theme === 'dark') return 'Dark'
    return isDark ? 'Dark (Auto)' : 'Light (Auto)'
  }

  return (
    <div className="flex items-center gap-3">
      {/* Custom Toggle Switch */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className={`theme-toggle relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            isDark 
              ? 'bg-primary-700 hover:bg-primary-500 theme-toggle-active' 
              : 'bg-secondary-500 hover:bg-secondary-700'
          }`}
          aria-label={`Current theme: ${getLabel()}. Click to toggle.`}
        >
          <span
            className={`theme-toggle-knob inline-block h-4 w-4 transform rounded-full bg-white dark:bg-black transition-all duration-300 ease-in-out ${
              isDark ? 'translate-x-6' : 'translate-x-1'
            }`}
          >
            <span className="flex items-center justify-center h-full text-xs transition-transform duration-300">
              <span className={`material-icons text-xs leading-none ${
                isDark ? 'text-white' : 'text-secondary-200'
              }`}>
                {isDark ? 'dark_mode' : 'light_mode'}
              </span>
            </span>
          </span>
        </button>
      </div>
    </div>
  )
} 