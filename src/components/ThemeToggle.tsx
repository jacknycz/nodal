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
              {isDark ? (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-secondary-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
} 