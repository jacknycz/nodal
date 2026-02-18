import type { BoardThemeDefinition } from './index'

// Presentation — high contrast, clean connectors, brand-ready
export const presentationTheme: BoardThemeDefinition = {
  respectDarkMode: false,
  background: '#ffffff',
  nodeColor: 'rgba(255,255,255,0.92)',
  nodeBorderRadius: '14px',
  nodeTitleColor: '#0f172a', // slate-900
  nodeContentColor: '#334155', // slate-700
  headlineColor: '#0f172a',
  edgeColor: '#0f172a',
  edgeHighlightColor: '#0f172a',
  edgeHighlightPulseColor: '#2563eb', // blue-600 accent pulse
  edgeArrowColor: '#1d4ed8', // blue-700 arrow
}

