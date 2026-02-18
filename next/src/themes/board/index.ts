export interface BoardThemeDefinition {
  background: string
  backgroundDark?: string
  respectDarkMode?: boolean
  edgeColor?: string
  edgeHighlightColor?: string
  // Used for direction overlay (pulse + arrowhead). Kept flexible to avoid theming every edge state.
  edgeHighlightPulseColor?: string
  edgeArrowColor?: string
  // Back-compat / convenience alias (treat as pulse + arrow if provided)
  edgeAccentColor?: string
  nodeColor?: string
  nodeBorderRadius?: string
  nodeTitleColor?: string
  nodeContentColor?: string
  headlineColor?: string
}

import { defaultTheme } from './default'
import { redTheme } from './red'
import { presentationTheme } from './presentation'
import { educationTheme } from './education'
import { creativeTheme } from './creative'
import { technicalTheme } from './technical'
import { scifiTheme } from './scifi'

const registry: Record<string, BoardThemeDefinition> = {
  default: defaultTheme,
  red: redTheme,
  presentation: presentationTheme,
  education: educationTheme,
  creative: creativeTheme,
  technical: technicalTheme,
  scifi: scifiTheme,
}

export function getBoardTheme(key: string): BoardThemeDefinition {
  const k = String(key || 'default').toLowerCase()
  return registry[k] || defaultTheme
}

export function normalizeBoardThemeKey(key: string): string {
  const k = String(key || 'default').toLowerCase()
  return registry[k] ? k : 'default'
}