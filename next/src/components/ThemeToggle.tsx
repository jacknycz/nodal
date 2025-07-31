import { useTheme } from '../contexts/ThemeContext'
import Toggle from './ui/Toggle'

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme()

  const getLabel = () => {
    if (theme === 'light') return 'Light Mode'
    if (theme === 'dark') return 'Dark Mode'
    return isDark ? 'Dark Mode (Auto)' : 'Light Mode (Auto)'
  }

  return (
    <Toggle
      checked={isDark}
      onChange={toggleTheme}
      size="md"
      label={getLabel()}
      // description="Toggle between light and dark themes"
      aria-label={`Current theme: ${getLabel()}. Click to toggle.`}
    />
  )
} 