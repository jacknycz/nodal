export interface BoardThemeDefinition {
  background: string
  backgroundDark?: string
  respectDarkMode?: boolean
}

import { defaultTheme } from './default'
import { blueTheme } from './blue'
import { redTheme } from './red'

const registry: Record<string, BoardThemeDefinition> = {
  default: defaultTheme,
  blue: blueTheme,
  red: redTheme,
}

export function getBoardTheme(key: string): BoardThemeDefinition {
  const k = String(key || 'default').toLowerCase()
  return registry[k] || defaultTheme
}

