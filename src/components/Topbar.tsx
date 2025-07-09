import React from 'react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'
import nodalBlackLogo from '../assets/nodal-black.svg'
import nodalWhiteLogo from '../assets/nodal-white.svg'

export default function Topbar() {
  const { isDark } = useTheme()

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={isDark ? nodalWhiteLogo : nodalBlackLogo}
            alt="Nodal Logo"
            className="h-8 w-auto"
          />
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            Nodal
          </span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  )
} 